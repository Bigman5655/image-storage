const crypto = require('crypto');
module.exports = (secretKey) => {
    return {
        encrypt: (text) => {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-ctr', secretKey, iv);
            const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
        
            return {
                iv: iv.toString('hex'),
                content: encrypted.toString('hex')
            };
        },
        decrypt: (hash) => {
            const decipher = crypto.createDecipheriv('aes-256-ctr', secretKey, Buffer.from(hash.iv, 'hex'));
            const decrypted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);
            return decrypted.toString();
        }
    };
}