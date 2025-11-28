BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bytesToBase32(bytes) {
    let result = '';
    let bits = 0;
    let value = 0;

    for(let i=0;i<bytes.length;i++){
        // Shift the value 8 bits to the left and add the byte at index i
        value = (value << 8) | bytes[i];
        bits += 8;
        while(bits >= 5){
            // Get the character from the BASE32_ALPHABET at the index of the 
            // first 5 bits of the value and append it to the result
            result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
        if (bits > 0) {
        result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return result;
    }
}

function generateSecret(length=32){
    // Create the byte array with the element value 0 of length 32
    const bytes= new Uint8Array(length);
    //Create the cryptographically secure random values and 
    // store it in the byte array
    crypto.getRandomValues(bytes);
    //For the TODM to work it must be converted to Base32
    return bytesToBase32(bytes);
}

console.log(generateSecret(16));