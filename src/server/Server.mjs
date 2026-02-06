import { createServer } from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { McpServerValidator } from 'x402-mcp-validator'

import { A2aProbe } from '../prober/A2aProbe.mjs'
import { StaticFiles } from './StaticFiles.mjs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const DOCS_PATH = join( __dirname, '..', '..', 'docs' )


class Server {


    static start( { port = 3000 } = {} ) {
        const server = createServer( async ( request, response ) => {
            try {
                await Server.#route( { request, response } )
            } catch( err ) {
                console.log( `Error: ${err.message}` )
                Server.#sendJson( { response, statusCode: 500, data: { error: err.message } } )
            }
        } )

        server.listen( port, () => {
            console.log( `x402 Validator running on http://localhost:${port}` )
        } )

        return { server }
    }


    static async #route( { request, response } ) {
        const { method, url } = request

        if( method === 'GET' && url === '/' ) {
            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: 'index.html', response } )

            return
        }

        if( method === 'GET' && url === '/style.css' ) {
            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: 'style.css', response } )

            return
        }

        if( method === 'POST' && url === '/api/validate' ) {
            const { body } = await Server.#readBody( { request } )
            await Server.#handleValidate( { body, response } )

            return
        }

        if( method === 'POST' && url === '/api/erc8004/validate' ) {
            const { body } = await Server.#readBody( { request } )
            await Server.#handleErc8004Validate( { body, response } )

            return
        }

        if( method === 'OPTIONS' ) {
            response.writeHead( 204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            } )
            response.end()

            return
        }

        response.writeHead( 404, { 'Content-Type': 'text/plain' } )
        response.end( 'Not Found' )
    }


    static async #handleValidate( { body, response } ) {
        const { url } = body

        if( !url || typeof url !== 'string' ) {
            Server.#sendJson( { response, statusCode: 400, data: { error: 'Missing or invalid "url" parameter' } } )

            return
        }

        if( !url.startsWith( 'https://' ) && !url.startsWith( 'http://' ) ) {
            Server.#sendJson( { response, statusCode: 400, data: { error: 'Only http:// and https:// URLs are allowed' } } )

            return
        }

        try {
            new URL( url )
        } catch( _e ) {
            Server.#sendJson( { response, statusCode: 400, data: { error: 'Invalid URL format' } } )

            return
        }

        const [ mcpData, a2aResult ] = await Promise.all( [
            Server.#probeMcp( { endpoint: url } ),
            A2aProbe.probe( { endpoint: url } )
        ] )

        const { probeResult: a2aProbe } = a2aResult
        const a2aMessages = a2aProbe.messages
            .filter( ( msg ) => msg.indexOf( 'Cannot read properties' ) === -1 )

        const data = {
            mcp: mcpData,
            a2a: { ...a2aProbe, messages: a2aMessages }
        }

        Server.#sendJson( { response, statusCode: 200, data } )
    }


    static async #probeMcp( { endpoint, timeout = 15000 } ) {
        try {
            const startPing = Date.now()
            const pingResponse = await fetch( endpoint, {
                method: 'HEAD',
                signal: AbortSignal.timeout( timeout )
            } ).catch( () => null )
            const latencyPingMs = Date.now() - startPing

            const startListTools = Date.now()
            const { status: validatorStatus, messages: validatorMessages, categories: validatorCategories, entries } = await McpServerValidator.start( {
                endpoint,
                timeout
            } )
            const latencyListToolsMs = Date.now() - startListTools

            const isReachable = pingResponse !== null || validatorStatus
            const hasTools = entries !== null && entries[ 'tools' ] !== undefined && entries[ 'tools' ].length > 0
            const supportsX402 = validatorCategories !== null && validatorCategories[ 'supportsX402' ] === true

            const categories = {
                isReachable,
                supportsMcp: validatorStatus,
                hasTools,
                hasResources: entries !== null && entries[ 'resources' ] !== undefined && entries[ 'resources' ].length > 0,
                hasPrompts: entries !== null && entries[ 'prompts' ] !== undefined && entries[ 'prompts' ].length > 0,
                supportsX402,
                hasValidPaymentRequirements: validatorCategories !== null && validatorCategories[ 'hasValidPaymentRequirements' ] === true,
                supportsExactScheme: validatorCategories !== null && validatorCategories[ 'supportsExactScheme' ] === true,
                supportsEvm: validatorCategories !== null && validatorCategories[ 'supportsEvm' ] === true,
                supportsSolana: validatorCategories !== null && validatorCategories[ 'supportsSolana' ] === true
            }

            const x402Data = entries !== null ? entries[ 'x402' ] : null
            const tools = hasTools ? entries[ 'tools' ] : []

            const summary = {
                serverName: entries !== null ? entries[ 'serverName' ] : null,
                serverVersion: entries !== null ? entries[ 'serverVersion' ] : null,
                toolCount: tools.length,
                resourceCount: categories.hasResources ? entries[ 'resources' ].length : 0,
                promptCount: categories.hasPrompts ? entries[ 'prompts' ].length : 0,
                x402ToolCount: x402Data !== null && x402Data[ 'tools' ] !== undefined ? x402Data[ 'tools' ].length : 0,
                networks: x402Data !== null && x402Data[ 'networks' ] !== undefined ? x402Data[ 'networks' ] : [],
                schemes: x402Data !== null && x402Data[ 'schemes' ] !== undefined ? x402Data[ 'schemes' ] : [],
                latencyPingMs,
                latencyListToolsMs
            }

            const x402Tools = x402Data !== null && x402Data[ 'tools' ] !== undefined ? x402Data[ 'tools' ] : []
            const x402PaymentRequirements = x402Data !== null && x402Data[ 'paymentRequirements' ] !== undefined ? x402Data[ 'paymentRequirements' ] : []

            return {
                timestamp: new Date().toISOString(),
                status: validatorStatus,
                categories,
                summary,
                tools,
                x402Tools,
                x402PaymentRequirements,
                messages: validatorMessages
            }
        } catch( error ) {
            return {
                timestamp: new Date().toISOString(),
                status: false,
                categories: {
                    isReachable: false, supportsMcp: false, hasTools: false,
                    hasResources: false, hasPrompts: false, supportsX402: false,
                    hasValidPaymentRequirements: false, supportsExactScheme: false,
                    supportsEvm: false, supportsSolana: false
                },
                summary: {
                    serverName: null, serverVersion: null, toolCount: 0,
                    resourceCount: 0, promptCount: 0, x402ToolCount: 0,
                    networks: [], schemes: [], latencyPingMs: null, latencyListToolsMs: null
                },
                tools: [],
                x402Tools: [],
                x402PaymentRequirements: [],
                messages: [ error.message ]
            }
        }
    }


    static async #handleErc8004Validate( { body, response } ) {
        const { registrationFile } = body

        if( !registrationFile || typeof registrationFile !== 'object' || Array.isArray( registrationFile ) ) {
            Server.#sendJson( { response, statusCode: 400, data: { error: 'Missing or invalid "registrationFile" parameter' } } )

            return
        }

        const jsonString = JSON.stringify( registrationFile )
        const base64String = Buffer.from( jsonString ).toString( 'base64' )
        const encodedUri = `data:application/json;base64,${base64String}`

        let result

        try {
            const { Erc8004RegistryParser } = await import( 'erc8004-registry-parser' )
            result = Erc8004RegistryParser.validateFromUri( { agentUri: encodedUri } )
        } catch( err ) {
            Server.#sendJson( { response, statusCode: 200, data: {
                status: false,
                messages: [ err.message ],
                categories: {},
                entries: {},
                encodedUri
            } } )

            return
        }

        const { status, messages, categories, entries } = result
        const data = { status, messages, categories, entries, encodedUri }

        Server.#sendJson( { response, statusCode: 200, data } )
    }


    static #readBody( { request, maxBytes = 1048576 } ) {
        return new Promise( ( resolve, reject ) => {
            const chunks = []
            let totalBytes = 0

            request.on( 'data', ( chunk ) => {
                totalBytes += chunk.length

                if( totalBytes > maxBytes ) {
                    request.destroy()
                    reject( new Error( 'Request body too large' ) )

                    return
                }

                chunks.push( chunk )
            } )

            request.on( 'end', () => {
                const raw = Buffer.concat( chunks ).toString()

                try {
                    const body = JSON.parse( raw )

                    resolve( { body } )
                } catch( _err ) {
                    reject( new Error( 'Invalid JSON body' ) )
                }
            } )

            request.on( 'error', ( err ) => {
                reject( err )
            } )
        } )
    }


    static #sendJson( { response, statusCode, data } ) {
        const json = JSON.stringify( data )

        response.writeHead( statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        } )
        response.end( json )
    }
}


const port = parseInt( process.env.PORT || '3000', 10 )
Server.start( { port } )
