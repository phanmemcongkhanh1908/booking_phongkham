const { inArray } = require("drizzle-orm");
const chs = inArray({_name: 'test', _col: 'id'}, ['1', '2']).queryChunks;
let op = "";
let val = null;
for (const ch of chs) {
    if (ch?.constructor?.name === "StringChunk") {
        const text = ch.value.join("").trim();
        if (text) {
          if (text.toLowerCase() === "in") op = "in";
          else if (text.toLowerCase() === "not in") op = "not in";
          else op = text;
        }
    } else if (!ch._name) {
        val = ch;
    }
}
console.log("val:", val);
