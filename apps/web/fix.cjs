const fs = require('fs');
let content = fs.readFileSync('src/components/voice-trainer/index.tsx', 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
content = content.replace(/\\\\n/g, '\\n');
fs.writeFileSync('src/components/voice-trainer/index.tsx', content);
