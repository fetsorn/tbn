pragma circom 2.1.4;

include "circomlib/poseidon.circom";
// include "https://github.com/0xPARC/circom-secp256k1/blob/master/circuits/bigint.circom";

template Example () {
    signal input a;
    signal input b;
    signal output c;
    
    c <== a * b;
    a === 42;
}

component main { public [ a ] } = Example();

/* INPUT = {
    "a": "42",
    "b": "77"
} */
