#! /usr/bin/env node
import {JsonRpcHttpServer} from "@alsadi/json_rpc_server";

(async function() {
    const server = new JsonRpcHttpServer("rpc", ["assets", "index.html", "favicon.ico"], "./public");
    server.add_method("books.list", async function({page, per_page}) {
        per_page = per_page || 10;
        const items = [];
        for (let i=0, j=(page-1)*per_page; i<per_page; ++i, ++j) {
            items.push({id: j, title: `book #${j} title goes here`});
        }
        return {items};
    }, function({page, per_page}) {
        if (!Number.isInteger(page)) {
            throw new Error("page should be integer");
        }
        if (!Number.isInteger(per_page)) {
            throw new Error("per_page should be integer");
        }
        return true;
    });
    server.listen(8080);
})();
