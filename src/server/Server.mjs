import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { McpAgentAssessment } from 'mcp-agent-assessment'

import { StaticFiles } from './StaticFiles.mjs'


const __dirname = dirname( fileURLToPath( import.meta.url ) )
const DOCS_PATH = join( __dirname, '..', '..', 'docs' )


class Server {
    static #sessionToken = randomUUID()
    static #dependencyInfo = null


    static start( { port = 3000 } = {} ) {
        Server.#loadDependencyInfo()
        const server = createServer( async ( request, response ) => {
            try {
                await Server.#route( { request, response } )
            } catch( err ) {
                console.log( `Error: ${err.message}` )
                Server.#sendJson( { response, statusCode: 500, data: { error: err.message } } )
            }
        } )

        server.listen( port, () => {
            console.log( `MCP Agent Validator running on http://localhost:${port}` )
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

        if( method === 'GET' && url === '/api/info' ) {
            Server.#sendJson( { response, statusCode: 200, data: Server.#dependencyInfo } )

            return
        }

        if( method === 'OPTIONS' ) {
            response.writeHead( 204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
