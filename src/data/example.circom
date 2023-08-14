pragma circom 2.1.4;

include "circomlib/poseidon.circom";
// include "https://github.com/0xPARC/circom-secp256k1/blob/master/circuits/bigint.circom";

template Example () {
    signal input a;
    signal output c;
    a === 42;
}

component main = Example();

/* INPUT = {
    "b": "77"
} */
