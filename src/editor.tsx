import React from "react"

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

export var circomWorker: Worker

export default function App() {
    const [running, setRunning] = React.useState<false | number>(false)
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
            circomWorker = workerRef.current
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
                value: codeExample,
                name: "main.circom",
                active: false,
            }],
        })
    }

    React.useEffect(() => {
            run()
    }, [])

    return (
        <div className="layout">
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

                                <div className="phase2">
                                    <input
                                        type="file"
                                        id="zkey_upload"
                                        accept=".zkey"
                                        className="hidden-file"
                                        onChange={(e) => {
                                            const file = e.target?.files?.[0]
                                            if (file) {
                                                const reader = new FileReader()
                                                reader.onload = () => {
                                                    workerRef.current!.postMessage(
                                                        {
                                                            type: "verify",
                                                            data: reader.result,
                                                        }
                                                    )
                                                    setRunning(Math.random())
                                                }
                                                reader.readAsArrayBuffer(file)
                                            }
                                        }}
                                    ></input>

                                    <button
                                        onClick={() => {
                                            workerRef.current!.postMessage({
                                                type: "groth16",
                                                url: location.href,
                                                // code: editor.getValue(),
                                            })
                                            setRunning(Math.random())
                                        }}
                                        title={
                                            "Click here to generate Groth16 prover and verifier keys," +
                                            " as well as a solidity verifier contract, and a sample interactive" +
                                            " SnarkJS web application. Note that the Groth16 proving system " +
                                            "requires a per-circuit trusted setup, and this implementation only" +
                                            " adds a single contribution which is insufficient for production. "
                                        }
                                    >
                                        Groth16
                                    </button>
                                    <button
                                        onClick={() => {
                                            workerRef.current!.postMessage({
                                                type: "plonk",
                                                url: location.href,
                                            })
                                            setRunning(Math.random())
                                        }}
                                        title={
                                            "Click here to generate PLONK prover and verifier keys," +
                                            " as well as a solidity verifier contract, and a sample interactive" +
                                            " SnarkJS web application."
                                        }
                                    >
                                        PLONK
                                    </button>
                                    <button
                                        title={
                                            "Upload a ZKey here to check that it is compiled from the same " +
                                            "source code as this."
                                        }
                                        onClick={() => {
                                            document
                                                .getElementById("zkey_upload")!
                                                .click()
                                        }}
                                    >
                                        Verify
                                    </button>
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
            <div className="time">
                <small>
                    <b>Cmd-.</b> to interrupt
                </small>
            </div>
        </div>
    )
}
