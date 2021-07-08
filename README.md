# JsonRpcServer

A simple JSON-RPC implementation

```shell
npm install --save '@alsadi/json_rpc_server'
```

```javascript
import {JsonRpcHttpServer} from "@alsadi/json_rpc_server";

async function books_list({page, per_page}) {
    // simulate database lookup
    per_page = per_page || 10;
    const items = [];
    for (let i=0, j=(page-1)*per_page; i<per_page; ++i, ++j) {
        items.push({id: j, title: `book #${j} title goes here`});
    }
    return {items};
} 

(async function() {
    const server = new JsonRpcHttpServer("rpc", ["assets", "index.html", "favicon.ico"], "./public");
    server.add_method("books.list", books_list);
    server.listen(8080);
})();
```

You can use strict standard request like this

```shell
curl -X POST -d '{"jsonrpc": "2.0", "method": "books.list", "params":{"page":1, "per_page":10}, "id":"xyz"}' 'http://localhost:8080/rpc' | jq
```

or simply, our extension

```shell
curl -X POST -d '{"params":{"page":1, "per_page": 10}}' 'http://localhost:8080/rpc/books.list' | jq
```

## Validation

adjust the code above to pass validate method that throws exceptions
or return false in case of invalid params, like this:

```javascript
function books_list_validate(params) {
    const {page, per_page} = params;
    if (!Number.isInteger(page)) {
        throw new Error("page should be integer");
    }
    if (!Number.isInteger(per_page)) {
        const e = new Error("page should be integer");
        e.code = 'invalid-per-page-value';
        e.field = "per_page";
        throw e;
    }
    return true;
}
server.add_method("books.list", books_list, books_list_validate);
```

For validation you can:

* Throw a coded exception (an exception with code property)
* return false with reasons of key being the param with a list of problems like this

```javascript
return [false, {
    "page": ["required field is missing"],
    "per_page": ["should be in range 1-100"],
}];
```

You don't need to write validation yourself as you can generate validators from your code (TS type-hints or JS-Doc):

* generate [JSON-Schema](https://json-schema.org/) from JS-Doc comments using [jsdoc-api](https://www.npmjs.com/package/jsdoc-api).
* or you can also use `TypeScript` to generate [`.d.ts` file](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html) from your code and then convert that to JSON-Schema and create run-time validators: [ts-to-json](https://github.com/ccpu/ts-to-json), [typescript-json-schema](https://github.com/YousefED/typescript-json-schema), [node-ts2json](https://github.com/jeremyfa/node-ts2json), ,[ts-json-object](https://github.com/moshegottlieb/ts-json-object), [ts-interface-checker](https://github.com/gristlabs/ts-interface-checker), [https://github.com/mizchi/dts-parser](https://github.com/mizchi/dts-parser), [io-ts](https://github.com/gcanti/io-ts), [parse-ts](https://github.com/jethrolarson/parse-ts).

for even use [TS compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
using

```bash
tsc lib/**/*.js --declaration --allowJs --emitDeclarationOnly --outFile index.d.ts
```


```javascript
const ts = require("typescript");
let r=ts.createSourceFile("index.d.ts", fs.readFileSync("index.d.ts", "utf-8"), ts.ScriptTarget.Latest)
let filename = "web/books"
let func = "action_list"
console.log(JSON.stringify(r.statements.filter(i=>i.name.text==filename)[0].body.statements.filter(i=>i.name.text==func)[0].parameters[0].type.members, null, 2))
```

* use [ajv](https://ajv.js.org/) to validate input params.

The best part about the above approach that the expensive part is done at build-time not runtime.

```javascript
async function() {
    // ...
    const method_name = "books.list";
    const schema_name = `rpc.${name}`;
    const fn = `${schema_name}.json`;
    const schema_str = (await fs.promises.readFile(`./schemas/${fn}`)).toString();
    const schema = JSON.parse(schema_str);
    ajv.addSchema(schema, name);
    // ...
    const validate = proj.ajv.getSchema(schema_name);
    server.add_method(method_name, callback, validate);
}
```
