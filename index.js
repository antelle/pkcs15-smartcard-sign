const fs = require('fs');
const crypto = require('crypto');
const ps = require('child_process');

module.exports.sign = function(config) {
    return Promise.resolve().then(() => {
        if (!config) {
            throw 'Bad config';
        }
        const algo = config.algo || 'sha256';
        if (!algo.startsWith('sha')) {
            throw 'Bad algo: expected sha256 or sha512';
        }
        if (!config.data instanceof Buffer) {
            throw 'Bad data: expected Buffer';
        }

        const hash = crypto.createHash(algo);
        hash.update(config.data);
        const sha256digest = hash.digest();

        const process = ps.spawn('pkcs15-crypt', [
            '--sign',
            '--signature-format', 'openssl',
            '--sha-' + algo.replace('sha', ''),
            '--pkcs1',
            '--key', config.key || '02',
            config.pin ? '--pin' : '', config.pin ? '-' : '',
            '--reader', config.reader || 0,
            '--raw'
        ], {stdio: 'pipe'});
        const stdout = [];
        const stderr = [];
        process.stderr.on('data', data => {
            stderr.push(data);
        });
        process.stdout.on('data', data => {
            stdout.push(data);
        });
        return new Promise((resolve, reject) => {
            process.stdout.on('end', () => {
                if (stdout.length) {
                    const signature = Buffer.concat(stdout);
                    resolve(signature);
                } else {
                    reject(Buffer.concat(stderr).toString() || 'pkcs15-crypt error');
                }
            });
            if (config.pin) {
                process.stdin.write(config.pin + '\n');
            }
            process.stdin.write(sha256digest);
            process.stdin.end();
        }).then(signature => {
            if (!config.verifyKey) {
                return signature;
            }
            const verify = crypto.createVerify(algo);
            verify.write(config.data);
            verify.end();
            if (verify.verify(config.verifyKey, signature)) {
                return signature
            } else {
                throw 'Validation error';
            }
        });
    });
};
