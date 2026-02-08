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

        const { data } = Server.#assessmentToLegacyFormat( { assessment } )

        Server.#sendJson( { response, statusCode: 200, data } )
    }


    static #assessmentToLegacyFormat( { assessment } ) {
        const { categories, entries, messages, layers } = assessment
        const mcpEntries = entries[ 'mcp' ] || {}
        const a2aEntries = entries[ 'a2a' ] || {}

        const x402Data = mcpEntries[ 'x402' ] || null
        const tools = mcpEntries[ 'tools' ] || []
        const x402Tools = x402Data !== null && Array.isArray( x402Data[ 'restrictedCalls' ] ) ? x402Data[ 'restrictedCalls' ] : []
        const x402PaymentRequirements = x402Data !== null && Array.isArray( x402Data[ 'paymentOptions' ] ) ? x402Data[ 'paymentOptions' ] : []
        const x402PerTool = x402Data !== null && typeof x402Data[ 'perTool' ] === 'object' ? x402Data[ 'perTool' ] : {}

        const mcpData = {
            timestamp: entries[ 'timestamp' ],
            status: categories[ 'supportsMcp' ] || false,
            categories: {
                isReachable: categories[ 'isReachable' ] || false,
                supportsMcp: categories[ 'supportsMcp' ] || false,
                hasTools: categories[ 'hasTools' ] || false,
                hasResources: categories[ 'hasResources' ] || false,
                hasPrompts: categories[ 'hasPrompts' ] || false,
                supportsX402: categories[ 'supportsX402' ] || false,
                hasValidPaymentRequirements: categories[ 'hasValidPaymentRequirements' ] || false,
                supportsExactScheme: categories[ 'supportsExactScheme' ] || false,
                supportsEvm: categories[ 'supportsEvm' ] || false,
                supportsSolana: categories[ 'supportsSolana' ] || false
            },
            summary: {
                serverName: mcpEntries[ 'serverName' ] || null,
                serverVersion: mcpEntries[ 'serverVersion' ] || null,
                toolCount: mcpEntries[ 'toolCount' ] || 0,
                resourceCount: mcpEntries[ 'resourceCount' ] || 0,
                promptCount: mcpEntries[ 'promptCount' ] || 0,
                x402ToolCount: x402Tools.length,
                networks: x402Data !== null && Array.isArray( x402Data[ 'networks' ] ) ? x402Data[ 'networks' ] : [],
                schemes: x402Data !== null && Array.isArray( x402Data[ 'schemes' ] ) ? x402Data[ 'schemes' ] : [],
                latencyPingMs: null,
                latencyListToolsMs: null
            },
            tools,
            x402Tools,
            x402PaymentRequirements,
            x402PerTool,
            messages: ( layers && layers[ 'mcp' ] && layers[ 'mcp' ][ 'messages' ] ) || []
        }

        const a2aMessages = ( layers && layers[ 'a2a' ] && layers[ 'a2a' ][ 'messages' ] ) || []

        const a2aData = {
            timestamp: entries[ 'timestamp' ],
            status: categories[ 'hasA2aCard' ] || false,
            categories: {
                isReachable: categories[ 'hasA2aCard' ] || false,
                hasAgentCard: categories[ 'hasA2aCard' ] || false,
                hasValidStructure: categories[ 'hasA2aValidStructure' ] || false,
                hasSkills: categories[ 'hasA2aSkills' ] || false,
                supportsStreaming: categories[ 'supportsA2aStreaming' ] || false,
                hasSecuritySchemes: categories[ 'hasA2aSecuritySchemes' ] || false,
                hasProvider: categories[ 'hasA2aProvider' ] || false,
                supportsPushNotifications: categories[ 'supportsA2aPushNotifications' ] || false,
                supportsJsonRpc: categories[ 'supportsA2aJsonRpc' ] || false,
                supportsGrpc: categories[ 'supportsA2aGrpc' ] || false,
                supportsExtendedCard: categories[ 'supportsA2aExtendedCard' ] || false,
                hasDocumentation: categories[ 'hasA2aDocumentation' ] || false
            },
            summary: {
                agentName: a2aEntries[ 'agentName' ] || null,
                agentDescription: a2aEntries[ 'agentDescription' ] || null,
                agentVersion: a2aEntries[ 'agentVersion' ] || null,
                skillCount: a2aEntries[ 'skillCount' ] || 0,
                skills: a2aEntries[ 'skills' ] || [],
                protocolBindings: a2aEntries[ 'protocolBindings' ] || [],
                protocolVersion: a2aEntries[ 'protocolVersion' ] || null,
                provider: a2aEntries[ 'provider' ] || null,
                latencyMs: null
            },
            messages: a2aMessages
        }

        const uiEntries = entries[ 'ui' ] || null
        const uiMessages = ( layers && layers[ 'ui' ] && layers[ 'ui' ][ 'messages' ] ) || []

        const uiData = {
            timestamp: entries[ 'timestamp' ],
            status: categories[ 'uiSupportsMcpApps' ] || false,
            categories: {
                supportsMcpApps: categories[ 'uiSupportsMcpApps' ] || false,
                hasUiResources: categories[ 'uiHasUiResources' ] || false,
                hasToolLinkage: categories[ 'uiHasToolLinkage' ] || false,
                hasValidHtml: categories[ 'uiHasValidHtml' ] || false,
                hasValidCsp: categories[ 'uiHasValidCsp' ] || false,
                supportsTheming: categories[ 'uiSupportsTheming' ] || false
            },
            summary: {
                extensionVersion: uiEntries !== null ? ( uiEntries[ 'extensionVersion' ] || null ) : null,
                uiResourceCount: uiEntries !== null ? ( uiEntries[ 'uiResourceCount' ] || 0 ) : 0,
                uiLinkedToolCount: uiEntries !== null ? ( uiEntries[ 'uiLinkedToolCount' ] || 0 ) : 0,
                appOnlyToolCount: uiEntries !== null ? ( uiEntries[ 'appOnlyToolCount' ] || 0 ) : 0,
                displayModes: uiEntries !== null && Array.isArray( uiEntries[ 'displayModes' ] ) ? uiEntries[ 'displayModes' ] : []
            },
            uiResources: uiEntries !== null && Array.isArray( uiEntries[ 'uiResources' ] ) ? uiEntries[ 'uiResources' ] : [],
            uiLinkedTools: uiEntries !== null && Array.isArray( uiEntries[ 'uiLinkedTools' ] ) ? uiEntries[ 'uiLinkedTools' ] : [],
            cspSummary: uiEntries !== null && uiEntries[ 'cspSummary' ] ? uiEntries[ 'cspSummary' ] : null,
            permissionsSummary: uiEntries !== null && Array.isArray( uiEntries[ 'permissionsSummary' ] ) ? uiEntries[ 'permissionsSummary' ] : [],
            messages: uiMessages
        }

        const oauthEntries = mcpEntries[ 'oauth' ] || null

        const oauthData = {
            timestamp: entries[ 'timestamp' ],
            status: categories[ 'supportsOAuth' ] || false,
            categories: {
                supportsOAuth: categories[ 'supportsOAuth' ] || false,
                hasProtectedResourceMetadata: categories[ 'hasProtectedResourceMetadata' ] || false,
                hasAuthServerMetadata: categories[ 'hasAuthServerMetadata' ] || false,
                supportsPkce: categories[ 'supportsPkce' ] || false,
                hasDynamicRegistration: categories[ 'hasDynamicRegistration' ] || false,
                hasValidOAuthConfig: categories[ 'hasValidOAuthConfig' ] || false
            },
            summary: {
                issuer: oauthEntries !== null ? ( oauthEntries[ 'issuer' ] || null ) : null,
                authorizationEndpoint: oauthEntries !== null ? ( oauthEntries[ 'authorizationEndpoint' ] || null ) : null,
                tokenEndpoint: oauthEntries !== null ? ( oauthEntries[ 'tokenEndpoint' ] || null ) : null,
                registrationEndpoint: oauthEntries !== null ? ( oauthEntries[ 'registrationEndpoint' ] || null ) : null,
                scopesSupported: oauthEntries !== null && Array.isArray( oauthEntries[ 'scopesSupported' ] ) ? oauthEntries[ 'scopesSupported' ] : [],
                grantTypesSupported: oauthEntries !== null && Array.isArray( oauthEntries[ 'grantTypesSupported' ] ) ? oauthEntries[ 'grantTypesSupported' ] : [],
                pkceMethodsSupported: oauthEntries !== null && Array.isArray( oauthEntries[ 'pkceMethodsSupported' ] ) ? oauthEntries[ 'pkceMethodsSupported' ] : []
            },
            messages: ( layers && layers[ 'mcp' ] && layers[ 'mcp' ][ 'messages' ] )
                ? layers[ 'mcp' ][ 'messages' ]
                    .filter( ( msg ) => {
                        const isAuth = typeof msg === 'string' && msg.startsWith( 'AUTH-' )

                        return isAuth
                    } )
                : []
        }

        const data = { mcp: mcpData, a2a: a2aData, ui: uiData, oauth: oauthData }

        return { data }
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
