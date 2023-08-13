import React from "react"

import { ethers } from "ethers";
import { solidityCompiler, getCompilerVersions } from "@agnostico/browser-solidity-compiler";

import codeExample from "./data/example.circom?raw"
import CircomWorker from "./worker/worker?worker"
import Ansi from "ansi-to-react"

// this is a workaround for what seems to be some kind of bug around
// importing raw urls from webworkers in production builds
import wasmURL from "circom2/circom.wasm?url"
import circomspectWasmURL from "circomspect/circomspect.wasm?url"
import circomLib from "./data/circomlib.zip?url"
console.log(circomLib, wasmURL, circomspectWasmURL)

type Message = {
    type: string
    text: string
    files?: Record<string, Uint8Array>
    url?: string
}

export default function App() {
    const [running, setRunning] = React.useState<false | number>(false)
    const [input, setInput] = React.useState<string>("42")
    const [messages, setMessages] = React.useState<Message[]>([])
    const workerRef = React.useRef<(Worker & { running?: boolean }) | null>(
        null
    )
    const [progress, setProgress] = React.useState(1)

    const run = () => {
        if (!workerRef.current || workerRef.current!.running) {
            if (workerRef.current) {
                workerRef.current.terminate()
                workerRef.current = null
            }
            workerRef.current = new CircomWorker()
            workerRef.current.onmessage = (e: MessageEvent) => {
                const data = e.data
                if (data.done) {
                    setRunning(false)
                    workerRef.current!.running = false
                } else if (data.type === "debug") {
                    console.log(data.text)
                } else if (data.type === "progress") {
                    setProgress(data.fraction)
                    return
                }

                if (data.type === "plonk keys") {
                    workerRef.current!.running = true
                    setRunning(Math.random() + 1)
                    const deploy = async () => {
                        const versions = await getCompilerVersions()
                        const version = versions.releases["0.8.18"]
                        const output = await solidityCompiler({
                            version: `https://binaries.soliditylang.org/bin/${version}`,
                            contractBody: data.files["main.plonk.sol"].replace('uint4', 'uint8'),
                            options: { optimizer: {
                                enabled: false,
                                runs: 200,
                            }},
                        })

                        const contract = output.contracts.Compiled_Contracts.PlonkVerifier

                        setMessages((k) => [...k, {
                            type: "compilation",
                            files: {
                                "main.plonk.sol.json": JSON.stringify(contract, 2),
                            }
                        }])

                        const provider = new ethers.BrowserProvider(window.ethereum)

                        const signer = await provider.getSigner();

                        const factory = ethers.ContractFactory.fromSolidity(contract, signer)

                        const deploying = await factory.deploy()

                        const deployed = await deploying.waitForDeployment()

                        setRunning(false)
                        workerRef.current!.running = false

                        setMessages((k) => [...k, {
                            type: "deployment",
                            text: deployed.target
                        }])
                    }

                    // NOTE compilations always output nonexistent uint4 data type
                    deploy(data.files["main.plonk.sol"].replace('uint4', 'uint8'))
                }

                setMessages((k) => [...k, data])
            }
            workerRef.current.onerror = (e) => {
                console.error(e)
                setMessages((k) => [
                    ...k,
                    {
                        type: "error",
                        text: e.message,
                    },
                ])
            }
        }
        workerRef.current!.running = true
        setRunning(Math.random() + 1)
        setMessages([])
        workerRef.current.postMessage({
            type: "run",
            files: [{
                value: codeExample.replace('42', input),
                name: "main.circom",
                active: false,
            }],
        })
    }


    React.useEffect(() => {
            run()
    }, [input])

    return (
        <div className="layout">
            <div className="primary">
                <div className="fff">
                    <input type="text" value={input} onChange={((e) => setInput(e.target.value))} />
                    <button onClick={() => {
                            workerRef.current!.postMessage({
                                type: "plonk",
                                url: location.href,
                            })
                            setRunning(Math.random())
                        }} title="generate and deploy verifier">Deploy</button>
                </div>
            </div>
            <div className="sidebar">
                <div className="output">
                    {messages.map((m, i) => (
                        <div key={i} className="message">
                            <div className="label">{m.type}: </div>
                            {m.type === "groth16 keys" && (
                                <div className="insecure">
                                    WARNING: These keys are strictly for testing
                                    purposes, and are generated without a proper
                                    trusted setup!
                                </div>
                            )}
                            {m.url ? (
                                <a href={m.url}>
                                    <Ansi>{m.text}</Ansi>
                                </a>
                            ) : (
                                <Ansi>{m.text}</Ansi>
                            )}
                            {m.files && (
                                <div className="files">
                                    {Object.entries(m.files).map(
                                        ([name, data]) => (
                                            <li key={name}>
                                                <a
                                                    href={URL.createObjectURL(
                                                        new Blob([data], {
                                                            type: "application/octet-stream",
                                                        })
                                                    )}
                                                    download={name}
                                                >
                                                    {name}
                                                </a>{" "}
                                                (
                                                {(data.length / 1000).toFixed(
                                                    2
                                                )}
                                                KB)
                                            </li>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {
                        !running && workerRef.current && (
                            <div>
                                <div className="label">
                                    Keys + Solidity + HTML:{" "}
                                </div>

                            </div>
                        )
                    }
                    {progress !== 1 && (
                        <div className="progress-container">
                            <progress value={progress} />
                        </div>
                    )}
                    {running ? <LoadingIndicator key={running} /> : null}
                </div>
            </div>
        </div>
    )
}

function LoadingIndicator() {
    const [time, setTime] = React.useState(0)
    React.useEffect(() => {
        const startTime = Date.now()
        const interval = setInterval(() => {
            setTime(Date.now() - startTime)
        }, 16)
        return () => clearInterval(interval)
    }, [])
    return (
        <div className="loading">
            <div className="lds-ellipsis">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
            {time > 200 && (
                <div className="time">{(time / 1000).toFixed(2)}s</div>
            )}
        </div>
    )
}
