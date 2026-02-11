import { randomUUID } from 'node:crypto'
import { McpServer as SdkMcpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

import { McpAgentAssessment } from 'mcp-agent-assessment'

import { AgentLookup } from '../prober/AgentLookup.mjs'


class McpServer {
    static #sessions = new Map()


    static createHandler() {
        const handler = async ( request, response ) => {
            const { method } = request

            if( method === 'DELETE' ) {
                const sessionId = request.headers[ 'mcp-session-id' ]

                if( sessionId && McpServer.#sessions.has( sessionId ) ) {
                    const { transport } = McpServer.#sessions.get( sessionId )
                    await transport.close()
                    McpServer.#sessions.delete( sessionId )
                }

                response.writeHead( 200 )
                response.end()

                return
            }

            const sessionId = request.headers[ 'mcp-session-id' ]

            if( sessionId && McpServer.#sessions.has( sessionId ) ) {
                const { transport } = McpServer.#sessions.get( sessionId )
                await transport.handleRequest( request, response )

                return
            }

            const { transport, server } = McpServer.#createSession()
            await server.connect( transport )
            await transport.handleRequest( request, response )

            if( transport.sessionId ) {
                McpServer.#sessions.set( transport.sessionId, { transport, server } )
            }
        }

        return { handler }
    }


    static #createSession() {
        const server = new SdkMcpServer(
            {
                name: 'mcp-agent-validator',
                version: '0.2.0'
            },
            {
                capabilities: {
                    tools: {},
                    resources: {},
                    experimental: {
                        'io.modelcontextprotocol/ui': { version: '2025-06-18' }
                    }
                }
            }
        )

        McpServer.#registerTools( { server } )
        McpServer.#registerResources( { server } )

        const transport = new StreamableHTTPServerTransport( {
            sessionIdGenerator: () => randomUUID()
        } )

        return { transport, server }
    }


    static #registerTools( { server } ) {
        server.registerTool(
            'validate_endpoint',
            {
                description: 'Validate an MCP, A2A, x402, or OAuth endpoint. Returns a multi-layer assessment with protocol support, tools, resources, payment requirements, and a grade.',
                inputSchema: {
                    url: z.string().describe( 'The endpoint URL to validate (must be http:// or https://)' ),
                    timeout: z.number().optional().describe( 'Request timeout in milliseconds (default: 15000)' )
                },
                _meta: {
                    ui: {
                        resourceUri: 'ui://validator/assessment-report',
                        visibility: [ 'model', 'app' ]
                    }
                }
            },
            async ( { url, timeout } ) => {
                const assessOptions = { endpoint: url }

                if( timeout !== undefined && typeof timeout === 'number' && timeout > 0 ) {
                    assessOptions[ 'timeout' ] = timeout
                }

                const assessment = await McpAgentAssessment.assess( assessOptions )

                const { textSummary } = McpServer.#formatAssessmentText( { assessment } )
                const { html } = McpServer.#formatAssessmentHtml( { assessment, url } )

                return {
                    content: [
                        { type: 'text', text: textSummary },
                        {
                            type: 'resource',
                            resource: {
                                uri: `assessment://${encodeURIComponent( url )}`,
                                mimeType: 'text/html',
                                text: html
                            }
                        }
                    ]
                }
            }
        )


        server.registerTool(
            'lookup_agent',
            {
                description: 'Look up an ERC-8004 registered agent on-chain. Returns registration data, spec compliance, services, and reputation from the on-chain registry.',
                inputSchema: {
                    agentId: z.number().int().positive().describe( 'The agent token ID in the ERC-8004 registry' ),
                    chainId: z.union( [ z.number(), z.string() ] ).describe( 'Chain ID (number) or CAIP-2 identifier (e.g., "eip155:84532")' ),
                    rpcNodes: z.record( z.string(), z.string() ).optional().describe( 'Optional RPC node overrides by chain alias' )
                },
                _meta: {
                    ui: {
                        resourceUri: 'ui://validator/lookup-report',
                        visibility: [ 'model', 'app' ]
                    }
                }
            },
            async ( { agentId, chainId, rpcNodes } ) => {
                const lookupOptions = { agentId, chainId }

                if( rpcNodes !== undefined ) {
                    lookupOptions[ 'rpcNodes' ] = rpcNodes
                }

                const lookupResult = await AgentLookup.lookup( lookupOptions )

                const { textSummary } = McpServer.#formatLookupText( { lookupResult, agentId, chainId } )
                const { html } = McpServer.#formatLookupHtml( { lookupResult, agentId, chainId } )

                return {
                    content: [
                        { type: 'text', text: textSummary },
                        {
                            type: 'resource',
                            resource: {
                                uri: `lookup://agent/${agentId}/${chainId}`,
                                mimeType: 'text/html',
                                text: html
                            }
                        }
                    ]
                }
            }
        )


        server.registerTool(
            'validate_client',
            {
                description: 'Introspect the connected MCP client. Returns client name, version, and supported capabilities.',
                inputSchema: {}
            },
            async ( _args, extra ) => {
                const lowLevelServer = server.server
                const clientInfo = lowLevelServer.getClientVersion() || { name: 'unknown', version: 'unknown' }
                const clientCapabilities = lowLevelServer.getClientCapabilities() || {}

                const { textSummary } = McpServer.#formatClientText( { clientInfo, clientCapabilities } )
                const { html } = McpServer.#formatClientHtml( { clientInfo, clientCapabilities } )

                return {
                    content: [
                        { type: 'text', text: textSummary },
                        {
                            type: 'resource',
                            resource: {
                                uri: 'client://info',
                                mimeType: 'text/html',
                                text: html
                            }
                        }
                    ]
                }
            }
        )
    }


    static #registerResources( { server } ) {
        server.resource(
            'Assessment Report',
            'ui://validator/assessment-report',
            {
                description: 'Interactive multi-protocol assessment report with verdict grid, protocol details, and raw data export',
                mimeType: 'text/html;profile=mcp-app'
            },
            async () => {
                const { html } = McpServer.#buildUiResourceHtml( {
                    title: 'Assessment Report',
                    body: '<p style="color:#94a3b8">Run <code>validate_endpoint</code> to generate an assessment report.</p>'
                } )

                return {
                    contents: [
                        {
                            uri: 'ui://validator/assessment-report',
                            mimeType: 'text/html;profile=mcp-app',
                            text: html,
                            _meta: {
                                ui: {
                                    csp: {
                                        connectDomains: [ 'self' ],
                                        resourceDomains: [ 'self' ],
                                        frameDomains: []
                                    },
                                    displayModes: [ 'inline', 'fullscreen' ]
                                }
                            }
                        }
                    ]
                }
            }
        )


        server.resource(
            'Lookup Report',
            'ui://validator/lookup-report',
            {
                description: 'ERC-8004 agent lookup report with registration data, verification status, and reputation',
                mimeType: 'text/html;profile=mcp-app'
            },
            async () => {
                const { html } = McpServer.#buildUiResourceHtml( {
                    title: 'Lookup Report',
                    body: '<p style="color:#94a3b8">Run <code>lookup_agent</code> to generate a lookup report.</p>'
                } )

                return {
                    contents: [
                        {
                            uri: 'ui://validator/lookup-report',
                            mimeType: 'text/html;profile=mcp-app',
                            text: html,
                            _meta: {
                                ui: {
                                    csp: {
                                        connectDomains: [ 'self' ],
                                        resourceDomains: [ 'self' ],
                                        frameDomains: []
                                    },
                                    displayModes: [ 'inline', 'fullscreen' ]
                                }
                            }
                        }
                    ]
                }
            }
        )
    }


    static #formatAssessmentText( { assessment } ) {
        const { status, categories, entries, messages } = assessment
        const grade = entries?.[ 'assessment' ]?.[ 'grade' ] || 'N/A'
        const serverName = entries?.[ 'mcp' ]?.[ 'serverName' ] || 'Unknown'
        const toolCount = entries?.[ 'mcp' ]?.[ 'toolCount' ] || 0
        const resourceCount = entries?.[ 'mcp' ]?.[ 'resourceCount' ] || 0

        const lines = [
            `Assessment: ${status ? 'PASS' : 'FAIL'} | Grade: ${grade}`,
            `Server: ${serverName}`,
            `Tools: ${toolCount} | Resources: ${resourceCount}`,
            '',
            'Protocol Support:',
            `  MCP: ${categories?.[ 'supportsMcp' ] ? 'Yes' : 'No'}`,
            `  A2A: ${categories?.[ 'hasA2aCard' ] ? 'Yes' : 'No'}`,
            `  x402: ${categories?.[ 'supportsX402' ] ? 'Yes' : 'No'}`,
            `  MCP Apps: ${categories?.[ 'supportsMcpApps' ] ? 'Yes' : 'No'}`
        ]

        if( messages && messages.length > 0 ) {
            lines.push( '', `Messages (${messages.length}):` )
            messages
                .forEach( ( msg ) => {
                    const text = typeof msg === 'string' ? msg : msg[ 'message' ] || JSON.stringify( msg )

                    lines.push( `  - ${text}` )
                } )
        }

        const textSummary = lines.join( '\n' )

        return { textSummary }
    }


    static #formatAssessmentHtml( { assessment, url } ) {
        const { status, categories, entries, messages } = assessment
        const grade = entries?.[ 'assessment' ]?.[ 'grade' ] || 'N/A'
        const serverName = McpServer.#escapeHtml( { text: entries?.[ 'mcp' ]?.[ 'serverName' ] || 'Unknown' } )
        const toolCount = entries?.[ 'mcp' ]?.[ 'toolCount' ] || 0
        const resourceCount = entries?.[ 'mcp' ]?.[ 'resourceCount' ] || 0
        const errorCount = entries?.[ 'assessment' ]?.[ 'errorCount' ] || 0
        const warningCount = entries?.[ 'assessment' ]?.[ 'warningCount' ] || 0
        const escapedUrl = McpServer.#escapeHtml( { text: url } )

        const verdictColor = status ? '#22c55e' : '#ef4444'
        const verdictLabel = status ? 'PASS' : 'FAIL'

        const protocols = [
            { name: 'MCP', active: categories?.[ 'supportsMcp' ] },
            { name: 'A2A', active: categories?.[ 'hasA2aCard' ] },
            { name: 'x402', active: categories?.[ 'supportsX402' ] },
            { name: 'MCP Apps', active: categories?.[ 'supportsMcpApps' ] }
        ]

        const protocolBadges = protocols
            .map( ( { name, active } ) => {
                const color = active ? '#22c55e' : '#6b7280'

                return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color};color:#fff;font-size:12px;margin:2px">${name}</span>`
            } )
            .join( '' )

        const messageRows = ( messages || [] )
            .map( ( msg ) => {
                const text = typeof msg === 'string' ? msg : msg[ 'message' ] || JSON.stringify( msg )
                const severity = typeof msg === 'object' ? msg[ 'severity' ] || 'INFO' : 'INFO'
                const severityColor = severity === 'ERROR' ? '#ef4444' : severity === 'WARNING' ? '#f59e0b' : '#6b7280'

                return `<tr><td style="color:${severityColor};font-weight:600;padding:4px 8px">${McpServer.#escapeHtml( { text: severity } )}</td><td style="padding:4px 8px">${McpServer.#escapeHtml( { text } )}</td></tr>`
            } )
            .join( '' )

        const html = `<!DOCTYPE html>
<html><head><style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#0f172a;color:#e2e8f0}
.card{background:#1e293b;border-radius:8px;padding:16px;margin-bottom:12px}
.grade{font-size:48px;font-weight:700;text-align:center;color:${verdictColor}}
.label{color:#94a3b8;font-size:12px;text-transform:uppercase}
.value{font-size:18px;font-weight:600}
table{width:100%;border-collapse:collapse}
tr:nth-child(even){background:#1e293b88}
</style></head><body>
<div class="card" style="text-align:center">
<div class="label">Endpoint Assessment</div>
<div class="grade">${grade}</div>
<div style="color:${verdictColor};font-weight:600">${verdictLabel}</div>
<div style="margin-top:8px;color:#94a3b8;font-size:13px">${escapedUrl}</div>
</div>
<div class="card">
<div class="label">Server</div>
<div class="value">${serverName}</div>
<div style="margin-top:8px">${protocolBadges}</div>
</div>
<div class="card" style="display:flex;gap:24px">
<div><div class="label">Tools</div><div class="value">${toolCount}</div></div>
<div><div class="label">Resources</div><div class="value">${resourceCount}</div></div>
<div><div class="label">Errors</div><div class="value" style="color:${errorCount > 0 ? '#ef4444' : '#22c55e'}">${errorCount}</div></div>
<div><div class="label">Warnings</div><div class="value" style="color:${warningCount > 0 ? '#f59e0b' : '#22c55e'}">${warningCount}</div></div>
</div>
${messageRows ? `<div class="card"><div class="label">Messages</div><table>${messageRows}</table></div>` : ''}
</body></html>`

        return { html }
    }


    static #formatLookupText( { lookupResult, agentId, chainId } ) {
        const { status, result, messages } = lookupResult

        const lines = [
            `Agent Lookup: ${status ? 'FOUND' : 'NOT FOUND'}`,
            `Agent ID: ${agentId} | Chain: ${result[ 'chainAlias' ] || chainId}`,
            `On-Chain Verified: ${result[ 'isOnChainVerified' ] ? 'Yes' : 'No'}`,
            `Spec Compliant: ${result[ 'isSpecCompliant' ] ? 'Yes' : 'No'}`
        ]

        if( result[ 'owner' ] ) {
            lines.push( `Owner: ${result[ 'owner' ]}` )
        }

        if( result[ 'services' ] && result[ 'services' ].length > 0 ) {
            lines.push( '', `Services (${result[ 'services' ].length}):` )
            result[ 'services' ]
                .forEach( ( svc ) => {
                    lines.push( `  - ${svc[ 'type' ] || svc[ 'name' ] || 'unknown'}: ${svc[ 'url' ] || svc[ 'endpoint' ] || 'N/A'}` )
                } )
        }

        if( result[ 'reputation' ] && result[ 'reputation' ][ 'feedbackCount' ] !== null ) {
            const rep = result[ 'reputation' ]

            lines.push( '', 'Reputation:' )
            lines.push( `  Feedback: ${rep[ 'feedbackCount' ]} | Avg: ${rep[ 'averageValue' ]}` )
            lines.push( `  Validations: ${rep[ 'validationCount' ]} | Avg Response: ${rep[ 'averageResponse' ]}ms` )
        }

        if( messages.length > 0 ) {
            lines.push( '', `Messages (${messages.length}):` )
            messages
                .forEach( ( msg ) => {
                    lines.push( `  - ${msg}` )
                } )
        }

        const textSummary = lines.join( '\n' )

        return { textSummary }
    }


    static #formatLookupHtml( { lookupResult, agentId, chainId } ) {
        const { status, result, messages } = lookupResult
        const chainAlias = McpServer.#escapeHtml( { text: result[ 'chainAlias' ] || String( chainId ) } )
        const verdictColor = status ? '#22c55e' : '#ef4444'
        const verdictLabel = status ? 'REGISTERED' : 'NOT FOUND'

        const owner = result[ 'owner' ] ? McpServer.#escapeHtml( { text: result[ 'owner' ] } ) : 'N/A'

        const checks = [
            { label: 'On-Chain Verified', value: result[ 'isOnChainVerified' ] },
            { label: 'Spec Compliant', value: result[ 'isSpecCompliant' ] },
            { label: 'x402 Support', value: result[ 'x402Support' ] },
            { label: 'Active', value: result[ 'isActive' ] }
        ]

        const checkRows = checks
            .map( ( { label, value } ) => {
                const icon = value === true ? '&#10003;' : value === false ? '&#10007;' : '&#8212;'
                const color = value === true ? '#22c55e' : value === false ? '#ef4444' : '#6b7280'

                return `<div style="display:flex;justify-content:space-between;padding:4px 0"><span>${label}</span><span style="color:${color};font-weight:700">${icon}</span></div>`
            } )
            .join( '' )

        let reputationBlock = ''

        if( result[ 'reputation' ] && result[ 'reputation' ][ 'feedbackCount' ] !== null ) {
            const rep = result[ 'reputation' ]

            reputationBlock = `<div class="card">
<div class="label">Reputation</div>
<div style="display:flex;gap:24px;margin-top:8px">
<div><div class="label">Feedback</div><div class="value">${rep[ 'feedbackCount' ]}</div></div>
<div><div class="label">Avg Rating</div><div class="value">${rep[ 'averageValue' ]}</div></div>
<div><div class="label">Validations</div><div class="value">${rep[ 'validationCount' ]}</div></div>
</div></div>`
        }

        let servicesBlock = ''

        if( result[ 'services' ] && result[ 'services' ].length > 0 ) {
            const serviceRows = result[ 'services' ]
                .map( ( svc ) => {
                    const svcType = McpServer.#escapeHtml( { text: svc[ 'type' ] || svc[ 'name' ] || 'unknown' } )
                    const svcUrl = McpServer.#escapeHtml( { text: svc[ 'url' ] || svc[ 'endpoint' ] || 'N/A' } )

                    return `<tr><td style="padding:4px 8px;font-weight:600">${svcType}</td><td style="padding:4px 8px;word-break:break-all">${svcUrl}</td></tr>`
                } )
                .join( '' )

            servicesBlock = `<div class="card"><div class="label">Services</div><table>${serviceRows}</table></div>`
        }

        const html = `<!DOCTYPE html>
<html><head><style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#0f172a;color:#e2e8f0}
.card{background:#1e293b;border-radius:8px;padding:16px;margin-bottom:12px}
.label{color:#94a3b8;font-size:12px;text-transform:uppercase}
.value{font-size:18px;font-weight:600}
table{width:100%;border-collapse:collapse}
tr:nth-child(even){background:#1e293b88}
</style></head><body>
<div class="card" style="text-align:center">
<div class="label">Agent Lookup</div>
<div style="font-size:48px;font-weight:700;color:${verdictColor}">#${agentId}</div>
<div style="color:${verdictColor};font-weight:600">${verdictLabel}</div>
<div style="margin-top:8px;color:#94a3b8;font-size:13px">${chainAlias}</div>
</div>
<div class="card">
<div class="label">Owner</div>
<div style="font-family:monospace;font-size:13px;word-break:break-all;margin-top:4px">${owner}</div>
</div>
<div class="card">${checkRows}</div>
${reputationBlock}
${servicesBlock}
</body></html>`

        return { html }
    }


    static #formatClientText( { clientInfo, clientCapabilities } ) {
        const lines = [
            `Client: ${clientInfo[ 'name' ] || 'unknown'} v${clientInfo[ 'version' ] || 'unknown'}`,
            '',
            'Capabilities:'
        ]

        const capKeys = Object.keys( clientCapabilities )

        if( capKeys.length === 0 ) {
            lines.push( '  (none reported)' )
        } else {
            capKeys
                .forEach( ( key ) => {
                    const val = clientCapabilities[ key ]

                    if( typeof val === 'object' && val !== null ) {
                        lines.push( `  ${key}: ${JSON.stringify( val )}` )
                    } else {
                        lines.push( `  ${key}: ${val}` )
                    }
                } )
        }

        const textSummary = lines.join( '\n' )

        return { textSummary }
    }


    static #formatClientHtml( { clientInfo, clientCapabilities } ) {
        const clientName = McpServer.#escapeHtml( { text: clientInfo[ 'name' ] || 'unknown' } )
        const clientVersion = McpServer.#escapeHtml( { text: clientInfo[ 'version' ] || 'unknown' } )

        const capKeys = Object.keys( clientCapabilities )
        const capRows = capKeys
            .map( ( key ) => {
                const val = clientCapabilities[ key ]
                const display = typeof val === 'object' && val !== null ? JSON.stringify( val ) : String( val )

                return `<tr><td style="padding:4px 8px;font-weight:600">${McpServer.#escapeHtml( { text: key } )}</td><td style="padding:4px 8px">${McpServer.#escapeHtml( { text: display } )}</td></tr>`
            } )
            .join( '' )

        const html = `<!DOCTYPE html>
<html><head><style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#0f172a;color:#e2e8f0}
.card{background:#1e293b;border-radius:8px;padding:16px;margin-bottom:12px}
.label{color:#94a3b8;font-size:12px;text-transform:uppercase}
.value{font-size:18px;font-weight:600}
table{width:100%;border-collapse:collapse}
tr:nth-child(even){background:#1e293b88}
</style></head><body>
<div class="card" style="text-align:center">
<div class="label">Connected MCP Client</div>
<div class="value" style="font-size:28px;margin-top:8px">${clientName}</div>
<div style="color:#94a3b8;font-size:14px;margin-top:4px">v${clientVersion}</div>
</div>
<div class="card">
<div class="label">Capabilities</div>
${capRows ? `<table style="margin-top:8px">${capRows}</table>` : '<div style="color:#6b7280;margin-top:8px">(none reported)</div>'}
</div>
</body></html>`

        return { html }
    }


    static #buildUiResourceHtml( { title, body } ) {
        const html = `<!DOCTYPE html>
<html><head><style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#0f172a;color:#e2e8f0}
.card{background:#1e293b;border-radius:8px;padding:16px;margin-bottom:12px}
.label{color:#94a3b8;font-size:12px;text-transform:uppercase}
code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:13px;color:#818cf8}
</style></head><body>
<div class="card" style="text-align:center">
<div class="label">${title}</div>
<div style="margin-top:12px">${body}</div>
</div>
</body></html>`

        return { html }
    }


    static #escapeHtml( { text } ) {
        const str = String( text )
        const escaped = str
            .replace( /&/g, '&amp;' )
            .replace( /</g, '&lt;' )
            .replace( />/g, '&gt;' )
            .replace( /"/g, '&quot;' )

        return escaped
    }
}


export { McpServer }
