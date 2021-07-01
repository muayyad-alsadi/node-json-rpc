import {SimpleHttpServer, PageNotFound, HttpCodedError} from "@alsadi/simple_http_server"

export class MethodNotFound extends PageNotFound {
    constructor() {
        super();
        this.code = "method-not-found";
        this.message = "Method not found";
    }

    finalize() {
        const method = (this.request||{}).rpc_method;
        if (method) {
            this.message = `Method [${method}] not found.`;
        }
    }
}

export class JsonRpcHttpServer extends SimpleHttpServer {
    constructor(rpc_uri, static_prefixes, static_dir) {
        super(static_prefixes, static_dir);
        this.rpc_uri = rpc_uri;
        this.methods = {};
    }

    /**
     * format error as json-rpc error
     * @param {Error} error
     * @return {Object} mime_type and body
     */
    format_error(error) {
        const id = (error.request||{}).req_id;
        const code = error.code || error.constructor.name
        const message = error.message;
        const trace = (process.env["NODE_ENV"]!="production")?error.stack:null;
        const mime_type = "application/json";
        // TODO: await to pass id, request details like uri ..etc.
        const obj = {"jsonrpc": "2.0", "error": {code, message, trace}, "id": id};
        const body = JSON.stringify(obj, "utf-8")+"\n";
        return {mime_type, body};
    }

    add_method(method_name, cb, validate) {
        this.methods[method_name] = [cb, validate];
    }

    async handle(request, response) {
        const self = this;
        const parts = request.uri_parts || [];
        if (!parts.length || parts[0]!=this.rpc_uri) {
            // TODO: call next() instead of throwing exception
            throw new PageNotFound();
        }
        let {method, params, id} = request.body_json_parsed;
        request.req_id = id;
        if (!method) {
            if (parts.length>1) {
                method = request.uri_parts[1];
            } else {
                throw new MethodNotFound();
            }
        }
        request.rpc_method = method;
        const cb_validate = self.methods[method];
        if (!cb_validate) {
            throw new MethodNotFound();
        }
        const [method_cb, validate] = cb_validate;
        if (validate) {
            try {
                if (!validate(params)) {
                    // TODO: detaild message
                    throw new HttpCodedError("prevalidate", `Pre-validate for method=[${method}].`, 400);
                }
            } catch (e) {
                if (!e.http_code) e.http_code = 400;
                throw e;
            }
        }
        const res = await method_cb(params, {user: request.user});
        const json_rpc_res = {"jsonrpc": "2.0", "result": res, "id": id};
        response.writeHead(200, {"Content-Type": "application/json"});
        response.end(JSON.stringify(json_rpc_res, "utf-8")+"\n");
    }
}
