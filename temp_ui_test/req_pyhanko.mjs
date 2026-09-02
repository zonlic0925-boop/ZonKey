import fs from 'fs';
const reqF = 'C:/Users/Zonlic/Desktop/ZonKey/requirements.txt';
let text = fs.readFileSync(reqF, 'utf-8');
if (!text.includes('pyHanko')) {
    fs.appendFileSync(reqF, '\n# P3 证书级 PDF 签名\npyHanko>=0.21\n');
}
