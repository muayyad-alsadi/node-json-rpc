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

export class FieldValidationError extends HttpCodedError {
    /**
     * @constructor
     * @param {string} field the name of the field
     * @param {string} msg error reason for that field
     * @param {string} code optional
     */
    constructor(field, msg, code) {
        msg = msg || `Invalid value for field [${field}]`;
        code = code || "field-validation";
        super(code, msg, 400);
        this.field = field;
        this.level="warning";
    }
}

export class ValidationError extends HttpCodedError {
    /**
     * @constructor
     * @param {Object<string, Array<string>>} validations mapping between field names and list of reasons
     * @param {string} msg optional
     * @param {string} code optional
     */
    constructor(validations, msg=null, code="fields-validation") {
        const fields_ls = Object.keys(validations)
        const fields = fields_ls.join(", ");
        msg = msg || ((fields_ls.length)?`Validation error on [${fields}]`:"Validation Error");
        super(code, msg, 400);
        this.validations = validations;
        this.level="warning";
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
        const code = error.code || error.constructor.name;
        const message = error.message;
        const validations = error.validations;
        const trace = (process.env["NODE_ENV"]!="production")?error.stack:null;
        const mime_type = "application/json";
        const obj = {"jsonrpc": "2.0", "error": {code, message, validations, trace}, "id": id};
        const body = JSON.stringify(obj, "utf-8")+"\n";
        return {mime_type, body};
    }

    add_method(method_name, cb, validate) {
        this.methods[method_name] = [cb, validate];
    }

    ws_attach(wss) {
        const self = this;
        wss.on("connection", function connection(ws) {
            ws.on("message", async function incoming(message) {
                let parsed;
                try {
                    parsed = JSON.parse(message);
                } catch (e) {
                    console.log(e);
                    return;
                }
                const {method, params, id} = parsed;
                let json_rpc_res;
                // away to pass auth context
                const res_promise = self.handle_parsed({method, params, id});
                if (!id) return;
                try {
                    json_rpc_res = await res_promise;
                } catch (error) {
                    error.request = error.request || {};
                    error.request.req_id = id;
                    const formatted = self.format_error(error);
                    ws.send(formatted.body);
                    return;
                }
                ws.send(JSON.stringify(json_rpc_res)+"\n");
            });
        });
    }
    async handle_parsed({method, params, id}, ctx) {
        const self = this;
        const cb_validate = self.methods[method];
        if (!cb_validate) {
            throw new MethodNotFound();
        }
        const [method_cb, validate] = cb_validate;
        if (validate) {
            try {
                const res = validate(params);
                if (Array.isArray(res)) {
                    const [is_valid, validations] = res;
                    // TODO: detaild message
                    if (!is_valid) {
                        const e = new ValidationError(validations);
                        e.method = method;
                        throw e;
                    }
                } else if (res===false) {
                    const e = new ValidationError({});
                    e.method = method;
                    throw e;
                }
            } catch (e) {
                e.method = method;
                e.level = e.level || "warning";
                e.http_code = e.http_code || 400;
                if (!e.validations && typeof e.field == "string") {
                    e.validations = {[e.field]: e.message};
                }
                throw e;
            }
        }
        let res;
        try {
            res = await method_cb(params, ctx);
        } catch(e) {
            e.method = method;
            if (!e.validations && typeof e.field == "string") {
                e.validations = {[e.field]: e.message};
            }
            throw e;
        }
        return {"jsonrpc": "2.0", "result": res, "id": id};
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
        const json_rpc_res = await self.handle_parsed({method, params, id}, {user: request.user});
        response.writeHead(200, {"Content-Type": "application/json"});
        response.end(JSON.stringify(json_rpc_res, "utf-8")+"\n");
    }
}
