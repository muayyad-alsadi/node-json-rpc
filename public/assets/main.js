async function rpc_call(method, params, id=null, extended=true) {
    const url = (extended)?`/rpc/${method}`:'/rpc';
    const body = {"jsonrpc": "2.0", "method": method, "params": params || {}};
    if (extended) {
        delete body.method;
    }
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    let parsed;
    if (!res.ok) {
        if (res.headers.get("content-type")=="application/json") {
            const text = await res.text();
            parsed = JSON.parse(text);
            const err = new Error(parsed.error.message);
            err.code = parsed.error.code;
            err.validations = parsed.error.validations;
            throw err;
        }
        throw new Error("req failed");
    }
    try {
        const text = await res.text();
        parsed = JSON.parse(text);
    } catch (e) {
        throw new Error("req failed");
    }
    if (parsed.error) {
        const err = new Error(parsed.error.message);
        err.code = parsed.error.code;
        throw err;
    }
    return parsed.result;
}

function getRndSuffix(len) {
    let ret="";
    for(let i=0;i<len;++i) {
      ret+=parseInt(Math.random()*16).toString(16);
    }
    return ret;
}


async function rpc_ws_call(method, params) {
    if (!window.rpc_ws) return;
    ++rpc_ws.counter;
    let id = (rpc_ws.counter).toString()+"."+rpc_ws.sfx;
    let req = {"jsonrpc": "2.0", "method": method, "params": params, "id": id};
    rpc_ws.socket.send(JSON.stringify(req));
    return new Promise(function(resolve, reject){
        rpc_ws.cbs_by_id[id] = [resolve, reject];
    });
}

function rpc_ws_notify(method, params) {
    if (!window.rpc_ws) return;
    let req = {"jsonrpc": "2.0", "method": method, "params": params};
    rpc_ws.socket.send(JSON.stringify(req));
}

(function(document, window) {
window.rpc_ws = window.rpc_ws || {}
const rpc_ws = window.rpc_ws
rpc_ws.cbs_by_id = rpc_ws.cbs_by_id || {};
rpc_ws.sfx = getRndSuffix(32);
rpc_ws.counter = 0;
window.ui = window.ui || {};
const ui = window.ui
let socket = new WebSocket('ws://localhost:8080/ws');
socket.addEventListener('open', function (event) {
    rpc_ws.socket = socket;
    rpc_ws.ready = true;
    console.log("socket ready");
});
socket.addEventListener('message', function (event) {
    const message = event.data;
    let parsed;
    try {
        parsed = JSON.parse(message);
    } catch(e) {
        return;
    }
    const id = parsed.id;
    if (!id) return;
    const callbacks = rpc_ws.cbs_by_id[id];
    if (!callbacks) return;
    delete rpc_ws.cbs_by_id[id];
    const [resolve, reject] = callbacks;
    if (parsed.error) {
        const err = new Error(parsed.error.message);
        err.code = parsed.error.code;
        err.validations = parsed.error.validations;
        return reject(err);
    }
    resolve(parsed.result);
});
ui.http_test_clicked = function() {
rpc_call("books.list", {page:1, per_page:10}).then(data=>alert("http: "+JSON.stringify(data, null, 2)));
}
ui.http_test_err_clicked = function() {
rpc_call("books.add", {page:"abc"}).then(data=>alert("http: "+JSON.stringify(data, null, 2))).catch(e=>alert("error: "+JSON.stringify({code:e.code, message:e.message, validations: e.validations}, null, 2)));
}
ui.ws_test_clicked = function() {
rpc_ws_call("books.list", {page:1, per_page:10}).then(data=>alert("ws: "+JSON.stringify(data, null, 2)));
}
ui.ws_test_err_clicked = function() {
rpc_ws_call("books.add", {page:"abc"}).then(data=>alert("ws: "+JSON.stringify(data, null, 2))).catch(e=>alert("error: "+JSON.stringify({code:e.code, message:e.message, validations: e.validations}, null, 2)));
}
})(document, window);



