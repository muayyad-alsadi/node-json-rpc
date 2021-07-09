#! /usr/bin/env node
import {JsonRpcHttpServer} from "@alsadi/json_rpc_server";
import http from "http";
import WebSocket from "ws";

(async function() {
    const server = new JsonRpcHttpServer("rpc", ["assets", "index.html", "favicon.ico"], "./public");
    const http_server = http.createServer((request, response)=>server.handle_w_errors(request, response));
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
            const e = new Error("page should be integer");
            e.code = "invalid-per-page-value";
            e.field = "per_page";
            throw e;
        }
        return true;
    });

    server.add_method("books.add", async function({title, author, topic_id}) {
        // add to database
        const id = parseInt(Math.random()*1000);
        return {id};
    }, function({title, author, topic_id}) {
        const e = new Error("Invalid book properties");
        e.code = "invalid-book-props";
        e.validations = {
            "title": ["too short"],
            "author": ["required field missing"],
            "topic_id": ["must be positive", "must be integer not float"],
        };
        throw e;
    });

    server.add_method("books.add_v2", async function({title, author, topic_id}) {
        // add to database
        const id = parseInt(Math.random()*1000);
        return {id};
    }, function({title, author, topic_id}) {
        return [false, {
            "title": ["too short"],
            "author": ["required field missing"],
            "topic_id": ["must be positive", "must be integer not float"],
        }];
    });
    const wss = new WebSocket.Server({server: http_server, path: "/ws"});
    server.ws_attach(wss);
    http_server.listen(8080);
})();
