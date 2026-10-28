export function buildRawMime({from,to,subject,html,text}) {
 for(const v of [from,to,subject])if(typeof v!=='string'||/[\r\n\x00-\x1f\x7f]/.test(v))throw new Error('Invalid MIME header');
 const encode=s=>Buffer.from(String(s),'utf8').toString('base64');
 const body=s=>encode(s).match(/.{1,76}/g)?.join('\r\n') || '';
 // Each encoded word is below RFC 2047's 75-character limit; split by code point.
 const words=[];let chunk='';for(const c of subject){if(Buffer.byteLength(chunk+c,'utf8')>42){words.push(`=?UTF-8?B?${encode(chunk)}?=`);chunk='';}chunk+=c;}if(chunk||!words.length)words.push(`=?UTF-8?B?${encode(chunk)}?=`);
 const boundary='span_quiz_alternative';
 const raw=`From: ${from}\r\nTo: ${to}\r\nSubject: ${words.join('\r\n ')}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${body(text)}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${body(html)}\r\n--${boundary}--\r\n`;
 return Buffer.from(raw,'utf8').toString('base64url');
}
