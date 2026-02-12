import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { McpAgentAssessment } from 'mcp-agent-assessment'

import { AgentLookup } from '../prober/AgentLookup.mjs'
import { McpServer } from '../mcp/McpServer.mjs'
import { StaticFiles } from './StaticFiles.mjs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const DOCS_PATH = join( __dirname, '..', '..', 'docs' )


class Server {
    static #sessionToken = randomUUID()
    static #dependencyInfo = null
    static #mcpHandler = null


    static start( { port = 3000 } = {} ) {
        const env = process.env.NODE_ENV || 'development'
        Server.#loadDependencyInfo()
        const { handler: mcpHandler } = McpServer.createHandler()
        Server.#mcpHandler = mcpHandler
        const server = createServer( async ( request, response ) => {
            try {
                if( env === 'development' ) {
                    console.log( `${request.method} ${request.url}` )
                }
                await Server.#route( { request, response } )
            } catch( err ) {
                console.log( `Error: ${err.message}` )
                Server.#sendJson( { response, statusCode: 500, data: { error: err.message } } )
            }
        } )

        server.listen( port, () => {
            console.log( `MCP Agent Validator running on http://localhost:${port} [${env}]` )
        } )

        return { server }
    }


    static async #route( { request, response } ) {
        const { method, url } = request

        if( method === 'GET' && url === '/' ) {
            response.setHeader( 'Set-Cookie', `__session=${Server.#sessionToken}; HttpOnly; SameSite=Strict; Path=/` )
            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: 'index.html', response } )

            return
        }

        if( method === 'GET' && url === '/style.css' ) {
            await StaticFiles.serve( { basePath: DOCS_PATH, filePath: 'style.css', response } )

            return
        }

        if( method === 'POST' && url.startsWith( '/api/' ) ) {
            const { authenticated } = Server.#authenticate( { request, response } )

            if( !authenticated ) {
                return
            }
        }

        if( method === 'POST' && url === '/api/assess' ) {
            const { body } = await Server.#readBody( { request } )
            await Server.#handleAssess( { body, response } )

            return
        }

        if( method === 'POST' && url === '/api/validate' ) {
            const { body } = await Server.#readBody( { request } )
            await Server.#handleValidate( { body, response } )

            return
        }

        if( method === 'POST' && url === '/api/lookup' ) {
            const { body } = await Server.#readBody( { request } )
            await Server.#handleLookup( { body, response } )

            return
        }

        if( method === 'GET' && url === '/api/info' ) {
            Server.#sendJson( { response, statusCode: 200, data: Server.#dependencyInfo } )

            return
        }

        if( method === 'GET' && ( url === '/.well-known/agent.json' || url === '/.well-known/agent-card.json' ) ) {
            Server.#sendJson( { response, statusCode: 200, data: Server.#getAgentCard( { request } ) } )

            return
        }

        if( url === '/mcp' ) {
            const accept = request.headers[ 'accept' ] || ''

            if( method === 'GET' && accept.includes( 'text/html' ) ) {
                Server.#sendMcpInfoPage( { request, response } )

                return
            }

            await Server.#mcpHandler( request, response )

            return
        }

        if( method === 'OPTIONS' ) {
            response.writeHead( 204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
                'Access-Control-Max-Age': '86400'
            } )
            response.end()

            return
        }

        response.writeHead( 404, { 'Content-Type': 'text/plain' } )
        response.end( 'Not Found' )
    }


    static async #handleAssess( { body, response } ) {
        const { url, timeout, erc8004 } = body

        const { error } = Server.#validateUrl( { url } )

        if( error ) {
            Server.#sendJson( { response, statusCode: 400, data: { error } } )

            return
        }

        const assessOptions = { endpoint: url }

        if( timeout !== undefined && typeof timeout === 'number' && timeout > 0 ) {
            assessOptions[ 'timeout' ] = timeout
        }

        if( erc8004 !== undefined && erc8004 !== null && typeof erc8004 === 'object' ) {
            assessOptions[ 'erc8004' ] = erc8004
        }

        const result = await McpAgentAssessment.assess( assessOptions )

        Server.#sendJson( { response, statusCode: 200, data: result } )
    }


    static async #handleValidate( { body, response } ) {
        const { url } = body

        const { error } = Server.#validateUrl( { url } )

        if( error ) {
            Server.#sendJson( { response, statusCode: 400, data: { error } } )

            return
        }

        const assessment = await McpAgentAssessment.assess( { endpoint: url } )

        Server.#sendJson( { response, statusCode: 200, data: assessment } )
    }


    static async #handleLookup( { body, response } ) {
        const { agentId, chainId, rpcNodes } = body

        const { error } = Server.#validateLookup( { agentId, chainId } )

        if( error ) {
            Server.#sendJson( { response, statusCode: 400, data: { error } } )

            return
        }

        const lookupOptions = {
            agentId: Number( agentId ),
            chainId: typeof chainId === 'string' ? chainId : Number( chainId )
        }

        if( rpcNodes !== undefined && rpcNodes !== null && typeof rpcNodes === 'object' ) {
            lookupOptions[ 'rpcNodes' ] = rpcNodes
        }

        const lookupResult = await AgentLookup.lookup( lookupOptions )

        Server.#sendJson( { response, statusCode: 200, data: lookupResult } )
    }


    static #validateLookup( { agentId, chainId } ) {
        if( agentId === undefined || agentId === null ) {
            return { error: 'Missing required "agentId" parameter' }
        }

        const numericAgentId = Number( agentId )

        if( !Number.isInteger( numericAgentId ) || numericAgentId <= 0 ) {
            return { error: '"agentId" must be a positive integer' }
        }

        if( chainId === undefined || chainId === null ) {
            return { error: 'Missing required "chainId" parameter' }
        }

        if( typeof chainId !== 'number' && typeof chainId !== 'string' ) {
            return { error: '"chainId" must be a number or string' }
        }

        return { error: null }
    }


    static #validateUrl( { url } ) {
        if( !url || typeof url !== 'string' ) {
            return { error: 'Missing or invalid "url" parameter' }
        }

        if( !url.startsWith( 'https://' ) && !url.startsWith( 'http://' ) ) {
            return { error: 'Only http:// and https:// URLs are allowed' }
        }

        try {
            new URL( url )
        } catch( _e ) {
            return { error: 'Invalid URL format' }
        }

        return { error: null }
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


    static #authenticate( { request, response } ) {
        const apiToken = process.env.API_TOKEN

        if( !apiToken ) {
            return { authenticated: true }
        }

        const cookieHeader = request.headers[ 'cookie' ] || ''
        const { sessionToken } = Server.#parseCookie( { cookieHeader, name: '__session' } )

        if( sessionToken === Server.#sessionToken ) {
            return { authenticated: true }
        }

        const authHeader = request.headers[ 'authorization' ] || ''
        const bearerToken = authHeader.startsWith( 'Bearer ' ) ? authHeader.slice( 7 ) : ''

        if( bearerToken === apiToken ) {
            return { authenticated: true }
        }

        Server.#sendJson( { response, statusCode: 401, data: { error: 'Unauthorized' } } )

        return { authenticated: false }
    }


    static #parseCookie( { cookieHeader, name } ) {
        const match = cookieHeader
            .split( '; ' )
            .find( ( pair ) => pair.startsWith( `${name}=` ) )
        const sessionToken = match ? match.slice( name.length + 1 ) : ''

        return { sessionToken }
    }


    static #sendJson( { response, statusCode, data } ) {
        const json = JSON.stringify( data )

        response.writeHead( statusCode, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } )
        response.end( json )
    }


    static #sendMcpInfoPage( { request, response } ) {
        const host = request.headers[ 'host' ] || 'localhost'
        const protocol = request.headers[ 'x-forwarded-proto' ] || 'http'
        const baseUrl = `${protocol}://${host}`

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MCP Server — MCP Agent Validator</title>
<style>
body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 0; background: #030712; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.container { max-width: 480px; padding: 48px 32px; text-align: center; }
.badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 20px; padding: 6px 14px; font-size: 13px; color: #a5b4fc; margin-bottom: 24px; }
.badge .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px; color: #fff; }
.subtitle { font-size: 15px; color: #94a3b8; margin: 0 0 32px; line-height: 1.5; }
.tools { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 24px; }
.tools h3 { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px; }
.tool { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; }
.tool:last-child { border-bottom: none; }
.tool-name { font-family: SFMono-Regular, Consolas, monospace; color: #818cf8; }
.tool-desc { color: #6b7280; font-size: 12px; }
.endpoint { font-family: SFMono-Regular, Consolas, monospace; font-size: 13px; color: #6b7280; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 16px; margin-bottom: 24px; }
.endpoint code { color: #a5b4fc; }
a { color: #818cf8; text-decoration: none; font-size: 13px; }
a:hover { color: #a5b4fc; text-decoration: underline; }
</style>
</head>
<body>
<div class="container">
<div class="badge"><span class="dot"></span> MCP Streamable HTTP</div>
<h1>MCP Agent Validator</h1>
<p class="subtitle">Multi-protocol assessment engine for MCP, A2A/AP2, x402, OAuth, MCP Apps, ERC-8004, and OASF.</p>
<div class="endpoint">POST <code>${baseUrl}/mcp</code></div>
<div class="tools">
<h3>Available Tools</h3>
<div class="tool"><span class="tool-name">validate_endpoint</span><span class="tool-desc">Assess an endpoint</span></div>
<div class="tool"><span class="tool-name">lookup_agent</span><span class="tool-desc">ERC-8004 registry</span></div>
<div class="tool"><span class="tool-name">validate_client</span><span class="tool-desc">Client introspection</span></div>
</div>
<a href="/">Open Validator UI</a>
</div>
</body>
</html>`

        response.writeHead( 200, {
            'Content-Type': 'text/html; charset=utf-8'
        } )
        response.end( html )
    }


    static #getAgentCard( { request } ) {
        const host = request.headers[ 'host' ] || 'localhost'
        const protocol = request.headers[ 'x-forwarded-proto' ] || 'http'
        const baseUrl = `${protocol}://${host}`

        const agentCard = {
            name: 'MCP Agent Validator',
            description: 'Multi-protocol assessment engine for MCP servers, A2A/AP2 agents, x402 payments, OAuth 2.1, MCP Apps, ERC-8004 registries, and OASF classification. Validates endpoints via server-side probes and provides detailed compatibility reports.',
            version: '0.2.0',
            documentation_url: 'https://github.com/FlowMCP/mcp-agent-validator',
            provider: {
                organization: 'FlowMCP',
                url: 'https://github.com/FlowMCP'
            },
            supported_interfaces: [
                {
                    url: `${baseUrl}/mcp`,
                    protocol_binding: 'JSONRPC',
                    protocol_version: '0.3'
                }
            ],
            capabilities: {
                streaming: true,
                push_notifications: false,
                extensions: [
                    {
                        uri: 'https://github.com/google-agentic-commerce/AP2/v1.0',
                        description: 'Supports Agent Payments Protocol discovery',
                        required: false
                    }
                ]
            },
            default_input_modes: [ 'application/json' ],
            default_output_modes: [ 'application/json', 'text/html' ],
            skills: [
                {
                    id: 'validate-endpoint',
                    name: 'Validate Endpoint',
                    description: 'Full multi-layer assessment of an MCP, A2A, x402, OAuth, or MCP Apps endpoint.',
                    tags: [ 'validation', 'mcp', 'a2a', 'x402', 'assessment' ]
                },
                {
                    id: 'lookup-agent',
                    name: 'Lookup Agent',
                    description: 'Query the ERC-8004 on-chain registry by agent ID for registration, verification, and reputation data.',
                    tags: [ 'erc8004', 'blockchain', 'registry', 'lookup' ]
                },
                {
                    id: 'validate-client',
                    name: 'Validate Client',
                    description: 'Introspect the connected MCP client and report its name, version, and capabilities.',
                    tags: [ 'mcp', 'client', 'introspection' ]
                }
            ]
        }

        return agentCard
    }


    static #loadDependencyInfo() {
        if( Server.#dependencyInfo !== null ) {
            return
        }

        const lockPath = join( __dirname, '..', '..', 'package-lock.json' )
        const depNames = [
            'mcp-agent-assessment',
            'a2a-agent-validator',
            'x402-mcp-validator',
            'mcp-apps-validator',
            'erc8004-registry-parser'
        ]

        try {
            const lockContent = JSON.parse( readFileSync( lockPath, 'utf-8' ) )
            const packages = lockContent[ 'packages' ] || {}

            const dependencies = depNames
                .map( ( name ) => {
                    const entry = packages[ `node_modules/${name}` ]

                    if( !entry || !entry[ 'resolved' ] ) {
                        return { name, version: entry ? ( entry[ 'version' ] || null ) : null, shortHash: null, commitUrl: null }
                    }

                    const resolved = entry[ 'resolved' ]
                    const hashIndex = resolved.lastIndexOf( '#' )
                    const fullHash = hashIndex !== -1 ? resolved.slice( hashIndex + 1 ) : null
                    const shortHash = fullHash ? fullHash.slice( 0, 7 ) : null
                    const commitUrl = fullHash ? `https://github.com/FlowMCP/${name}/commit/${fullHash}` : null

                    return { name, version: entry[ 'version' ] || null, shortHash, commitUrl }
                } )

            Server.#dependencyInfo = { dependencies }
        } catch( _err ) {
            Server.#dependencyInfo = { dependencies: [] }
        }
    }
}


const port = parseInt( process.env.PORT || '4000', 10 )
Server.start( { port } )
