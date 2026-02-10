import { EventEmitter } from 'node:events'
import { readFileSync as realReadFileSync } from 'node:fs'
import { jest } from '@jest/globals'


let requestHandler
let McpAgentAssessment
let mockReadFileSync


function createMockRequest( { method, url, body = null, headers = {} } ) {
    const req = new EventEmitter()
    req.method = method
    req.url = url
    req.headers = headers
    req.destroy = jest.fn()

    if( body !== null ) {
        process.nextTick( () => {
            req.emit( 'data', Buffer.from( JSON.stringify( body ) ) )
            req.emit( 'end' )
        } )
    }

    return req
}


function createMockResponse() {
    const res = {
        statusCode: null,
        headers: {},
        singleHeaders: {},
        body: null,
        setHeader( name, value ) {
            res.singleHeaders[ name ] = value
        },
        writeHead( code, headers ) {
            res.statusCode = code
            res.headers = headers
        },
        end( data ) {
            res.body = data
        }
    }

    return res
}


const MOCK_ASSESSMENT = {
    status: true,
    messages: [
        { code: 'PRB-001', severity: 'INFO', layer: 1, location: 'tools', message: 'PRB-001 tools: Found 1 tools' }
    ],
    categories: {
        isReachable: true,
        supportsMcp: true,
        hasTools: true,
        hasResources: false,
        hasPrompts: false,
        supportsX402: true,
        hasValidPaymentRequirements: true,
        supportsExactScheme: true,
        supportsEvm: true,
        supportsSolana: false,
        supportsTasks: false,
        supportsMcpApps: false,
        uiSupportsMcpApps: false,
        uiHasUiResources: false,
        uiHasToolLinkage: false,
        uiHasValidHtml: false,
        uiHasValidCsp: false,
        uiSupportsTheming: false,
        hasA2aCard: false,
        hasA2aValidStructure: false,
        hasA2aSkills: false,
        supportsA2aStreaming: false,
        overallHealthy: true
    },
    entries: {
        endpoint: 'https://example.com/mcp',
        timestamp: '2026-02-07T10:00:00.000Z',
        mcp: {
            serverName: 'Test Server',
            serverVersion: '1.0',
            toolCount: 1,
            resourceCount: 0,
            promptCount: 0,
            tools: [ { name: 'tool1' } ],
            resources: [],
            prompts: [],
            x402: {
                tools: [ { name: 'tool1' } ],
                networks: [ 'base' ],
                schemes: [ 'exact' ],
                paymentRequirements: []
            },
            latency: 100
        },
        a2a: null,
        ui: null,
        erc8004: null,
        reputation: null,
        assessment: { errorCount: 0, warningCount: 0, infoCount: 1, grade: 'A' }
    },
    layers: {
        mcp: {
            status: true,
            messages: [],
            categories: { supportsX402: true },
            entries: { serverName: 'Test Server' }
        },
        a2a: {
            status: false,
            messages: [ 'Not A2A' ],
            categories: {},
            entries: {}
        },
        ui: {
            status: false,
            messages: [],
            categories: {},
            entries: {}
        },
        erc8004: null,
        reputation: null
    }
}


const MOCK_LOCK = JSON.stringify( {
    packages: {
        'node_modules/mcp-agent-assessment': {
            version: '0.1.0',
            resolved: 'git+ssh://git@github.com/FlowMCP/mcp-agent-assessment.git#15bb11eb59d99b2efa546756c07d2ded477f39d4'
        },
        'node_modules/a2a-agent-validator': {
            version: '0.1.0',
            resolved: 'git+ssh://git@github.com/FlowMCP/a2a-agent-validator.git#eefae699ab6f2e61f5f53834071a2a2fac7bff10'
        },
        'node_modules/x402-mcp-validator': {
            version: '0.1.0',
            resolved: 'git+ssh://git@github.com/FlowMCP/x402-mcp-validator.git#cf074bd99f86c7c731b2d721d4e63b5c6748cebf'
        },
        'node_modules/mcp-apps-validator': {
            version: '0.1.0',
            resolved: 'git+ssh://git@github.com/FlowMCP/mcp-apps-validator.git#df6009ac46f0c70e30ee966985342ef0a6441065'
        },
        'node_modules/erc8004-registry-parser': {
            version: '0.1.0',
            resolved: 'git+ssh://git@github.com/FlowMCP/erc8004-registry-parser.git#922eb6556a0c93be76b2a9e56582827f4ba38297'
        }
    }
} )


beforeAll( async () => {
    jest.spyOn( console, 'log' ).mockImplementation( () => {} )

    mockReadFileSync = jest.fn( ( filePath, encoding ) => {
        if( typeof filePath === 'string' && filePath.endsWith( 'package-lock.json' ) ) {
            return MOCK_LOCK
        }

        return realReadFileSync( filePath, encoding )
    } )

    jest.unstable_mockModule( 'node:fs', () => ( {
        readFileSync: mockReadFileSync
    } ) )

    jest.unstable_mockModule( 'node:http', () => ( {
        createServer: jest.fn( ( handler ) => {
            requestHandler = handler

            return { listen: jest.fn( ( _port, cb ) => { if( cb ) cb() } ) }
        } )
    } ) )

    jest.unstable_mockModule( 'mcp-agent-assessment', () => ( {
        McpAgentAssessment: { assess: jest.fn() }
    } ) )

    const assessmentMod = await import( 'mcp-agent-assessment' )
    McpAgentAssessment = assessmentMod.McpAgentAssessment

    await import( '../../src/server/Server.mjs' )
} )


afterAll( () => {
    jest.restoreAllMocks()
} )


beforeEach( () => {
    McpAgentAssessment.assess.mockReset()
    delete process.env.API_TOKEN
} )


describe( 'Server', () => {
    describe( 'static routes', () => {
        test( 'GET / serves index.html', async () => {
            const request = createMockRequest( { method: 'GET', url: '/' } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )
            expect( response.headers[ 'Content-Type' ] ).toBe( 'text/html; charset=utf-8' )
            expect( response.body.toString() ).toContain( '<!DOCTYPE html>' )
        } )


        test( 'GET /style.css serves stylesheet', async () => {
            const request = createMockRequest( { method: 'GET', url: '/style.css' } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )
            expect( response.headers[ 'Content-Type' ] ).toBe( 'text/css; charset=utf-8' )
        } )


        test( 'GET /unknown returns 404', async () => {
            const request = createMockRequest( { method: 'GET', url: '/unknown' } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 404 )
            expect( response.body ).toBe( 'Not Found' )
        } )
    } )


    describe( 'GET /api/info', () => {
        test( 'returns dependency info with hashes and commit URLs', async () => {
            const request = createMockRequest( { method: 'GET', url: '/api/info' } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )

            const data = JSON.parse( response.body )
            expect( data.dependencies ).toBeDefined()
            expect( data.dependencies ).toHaveLength( 5 )

            const assessment = data.dependencies.find( ( d ) => d.name === 'mcp-agent-assessment' )
            expect( assessment.shortHash ).toBe( '15bb11e' )
            expect( assessment.commitUrl ).toBe( 'https://github.com/FlowMCP/mcp-agent-assessment/commit/15bb11eb59d99b2efa546756c07d2ded477f39d4' )
            expect( assessment.version ).toBe( '0.1.0' )

            const a2a = data.dependencies.find( ( d ) => d.name === 'a2a-agent-validator' )
            expect( a2a.shortHash ).toBe( 'eefae69' )
            expect( a2a.commitUrl ).toContain( 'FlowMCP/a2a-agent-validator/commit/' )
        } )


        test( 'does not require authentication', async () => {
            process.env.API_TOKEN = 'test-secret-token'

            const request = createMockRequest( { method: 'GET', url: '/api/info' } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )

            const data = JSON.parse( response.body )
            expect( data.dependencies ).toBeDefined()
        } )
    } )


    describe( 'OPTIONS preflight', () => {
        test( 'returns 204 with CORS headers', async () => {
            const request = createMockRequest( { method: 'OPTIONS', url: '/api/validate' } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 204 )
            expect( response.headers[ 'Access-Control-Allow-Origin' ] ).toBe( '*' )
            expect( response.headers[ 'Access-Control-Allow-Methods' ] ).toContain( 'POST' )
            expect( response.headers[ 'Access-Control-Allow-Headers' ] ).toBe( 'Content-Type, Authorization' )
            expect( response.headers[ 'Access-Control-Max-Age' ] ).toBe( '86400' )
        } )
    } )


    describe( 'POST /api/assess', () => {
        test( 'returns full assessment result for valid URL', async () => {
            McpAgentAssessment.assess.mockResolvedValue( MOCK_ASSESSMENT )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/assess',
                body: { url: 'https://example.com/mcp' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )

            const data = JSON.parse( response.body )
            expect( data.status ).toBe( true )
            expect( data.categories.supportsMcp ).toBe( true )
            expect( data.entries.mcp.serverName ).toBe( 'Test Server' )
            expect( data.entries.assessment.grade ).toBe( 'A' )
            expect( data.messages ).toHaveLength( 1 )
            expect( data.layers ).toBeDefined()
        } )


        test( 'passes timeout and erc8004 to assess', async () => {
            McpAgentAssessment.assess.mockResolvedValue( MOCK_ASSESSMENT )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/assess',
                body: {
                    url: 'https://example.com/mcp',
                    timeout: 30000,
                    erc8004: { rpcNodes: { 'ETHEREUM_MAINNET': 'https://eth.example.com' } }
                }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )
            expect( McpAgentAssessment.assess ).toHaveBeenCalledWith( {
                endpoint: 'https://example.com/mcp',
                timeout: 30000,
                erc8004: { rpcNodes: { 'ETHEREUM_MAINNET': 'https://eth.example.com' } }
            } )
        } )


        test( 'returns 400 for missing URL', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/assess',
                body: {}
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'url' )
        } )


        test( 'returns 400 for non-http URL', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/assess',
                body: { url: 'file:///etc/passwd' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'http' )
        } )
    } )


    describe( 'POST /api/validate', () => {
        test( 'returns raw assessment for valid URL', async () => {
            McpAgentAssessment.assess.mockResolvedValue( MOCK_ASSESSMENT )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/mcp' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )

            const data = JSON.parse( response.body )
            expect( data.status ).toBe( true )
            expect( data.categories.supportsMcp ).toBe( true )
            expect( data.categories.supportsX402 ).toBe( true )
            expect( data.entries.mcp.serverName ).toBe( 'Test Server' )
            expect( data.entries.mcp.tools ).toHaveLength( 1 )
            expect( data.entries.a2a ).toBeNull()
            expect( data.entries.ui ).toBeNull()
            expect( data.entries.assessment.grade ).toBe( 'A' )
            expect( data.messages ).toHaveLength( 1 )
            expect( data.layers ).toBeDefined()
        } )


        test( 'returns 400 for missing URL', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: {}
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'url' )
        } )


        test( 'returns 400 for numeric URL', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 12345 }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'url' )
        } )


        test( 'blocks non-http URLs (SSRF protection)', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'file:///etc/passwd' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'http' )
        } )


        test( 'blocks invalid URL format', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'http://[invalid' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'URL' )
        } )


        test( 'includes A2A layer messages in raw assessment', async () => {
            const assessmentWithA2aErrors = {
                ...MOCK_ASSESSMENT,
                layers: {
                    ...MOCK_ASSESSMENT.layers,
                    a2a: {
                        status: false,
                        messages: [ 'CSV-023: Missing required field "supported_interfaces"', 'Not an A2A endpoint' ],
                        categories: {},
                        entries: {}
                    }
                }
            }

            McpAgentAssessment.assess.mockResolvedValue( assessmentWithA2aErrors )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/test' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            const data = JSON.parse( response.body )
            expect( data.layers.a2a.messages ).toHaveLength( 2 )
            expect( data.layers.a2a.messages[ 0 ] ).toBe( 'CSV-023: Missing required field "supported_interfaces"' )
            expect( data.layers.a2a.messages[ 1 ] ).toBe( 'Not an A2A endpoint' )
        } )


        test( 'returns UI data in raw assessment when MCP Apps are active', async () => {
            const assessmentWithUi = {
                ...MOCK_ASSESSMENT,
                categories: {
                    ...MOCK_ASSESSMENT.categories,
                    uiSupportsMcpApps: true,
                    uiHasUiResources: true,
                    uiHasToolLinkage: true,
                    uiHasValidHtml: true,
                    uiHasValidCsp: false,
                    uiSupportsTheming: true
                },
                entries: {
                    ...MOCK_ASSESSMENT.entries,
                    ui: {
                        extensionVersion: '1.0.0',
                        uiResourceCount: 2,
                        uiLinkedToolCount: 1,
                        appOnlyToolCount: 0,
                        displayModes: [ 'embedded', 'fullscreen' ],
                        uiResources: [
                            { uri: 'ui://dashboard', mimeType: 'text/html', hasCsp: true, displayModes: [ 'embedded' ] },
                            { uri: 'ui://settings', mimeType: 'text/html', hasCsp: false, displayModes: [ 'fullscreen' ] }
                        ],
                        uiLinkedTools: [
                            { name: 'tool1', visibility: [ 'ui' ], resourceUri: 'ui://dashboard' }
                        ],
                        cspSummary: { defaultSrc: "'self'" },
                        permissionsSummary: [ 'clipboard-read', 'geolocation' ]
                    }
                },
                layers: {
                    ...MOCK_ASSESSMENT.layers,
                    ui: {
                        status: true,
                        messages: [ 'UI-001 ui: Found 2 UI resources' ],
                        categories: { uiSupportsMcpApps: true },
                        entries: {}
                    }
                }
            }

            McpAgentAssessment.assess.mockResolvedValue( assessmentWithUi )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/mcp' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )

            const data = JSON.parse( response.body )
            expect( data.categories.uiSupportsMcpApps ).toBe( true )
            expect( data.categories.uiHasUiResources ).toBe( true )
            expect( data.categories.uiHasToolLinkage ).toBe( true )
            expect( data.categories.uiSupportsTheming ).toBe( true )
            expect( data.entries.ui ).toBeDefined()
            expect( data.entries.ui.extensionVersion ).toBe( '1.0.0' )
            expect( data.entries.ui.uiResourceCount ).toBe( 2 )
            expect( data.entries.ui.uiLinkedToolCount ).toBe( 1 )
            expect( data.entries.ui.displayModes ).toEqual( [ 'embedded', 'fullscreen' ] )
            expect( data.entries.ui.uiResources ).toHaveLength( 2 )
            expect( data.entries.ui.uiLinkedTools ).toHaveLength( 1 )
            expect( data.entries.ui.cspSummary ).toEqual( { defaultSrc: "'self'" } )
            expect( data.entries.ui.permissionsSummary ).toEqual( [ 'clipboard-read', 'geolocation' ] )
            expect( data.layers.ui.messages ).toHaveLength( 1 )
            expect( data.layers.ui.messages[ 0 ] ).toBe( 'UI-001 ui: Found 2 UI resources' )
        } )
    } )


    describe( 'authentication', () => {
        test( 'allows POST without auth when API_TOKEN is not set', async () => {
            McpAgentAssessment.assess.mockResolvedValue( MOCK_ASSESSMENT )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/mcp' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )
        } )


        test( 'allows POST with valid session cookie', async () => {
            process.env.API_TOKEN = 'test-secret-token'
            McpAgentAssessment.assess.mockResolvedValue( MOCK_ASSESSMENT )

            const getRequest = createMockRequest( { method: 'GET', url: '/' } )
            const getResponse = createMockResponse()

            await requestHandler( getRequest, getResponse )

            const cookieHeader = getResponse.singleHeaders[ 'Set-Cookie' ]
            const sessionToken = cookieHeader.split( '=' )[ 1 ].split( ';' )[ 0 ]

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/mcp' },
                headers: { cookie: `__session=${sessionToken}` }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )
        } )


        test( 'allows POST with valid Bearer token', async () => {
            process.env.API_TOKEN = 'test-secret-token'
            McpAgentAssessment.assess.mockResolvedValue( MOCK_ASSESSMENT )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/mcp' },
                headers: { authorization: 'Bearer test-secret-token' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )
        } )


        test( 'rejects POST without auth when API_TOKEN is set', async () => {
            process.env.API_TOKEN = 'test-secret-token'

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/mcp' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 401 )

            const data = JSON.parse( response.body )
            expect( data.error ).toBe( 'Unauthorized' )
        } )


        test( 'rejects POST with wrong Bearer token', async () => {
            process.env.API_TOKEN = 'test-secret-token'

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/mcp' },
                headers: { authorization: 'Bearer wrong-token' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 401 )

            const data = JSON.parse( response.body )
            expect( data.error ).toBe( 'Unauthorized' )
        } )


        test( 'GET / is not protected by auth', async () => {
            process.env.API_TOKEN = 'test-secret-token'

            const request = createMockRequest( { method: 'GET', url: '/' } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )
        } )


        test( 'GET / sets session cookie', async () => {
            const request = createMockRequest( { method: 'GET', url: '/' } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.singleHeaders[ 'Set-Cookie' ] ).toBeDefined()
            expect( response.singleHeaders[ 'Set-Cookie' ] ).toContain( '__session=' )
            expect( response.singleHeaders[ 'Set-Cookie' ] ).toContain( 'HttpOnly' )
            expect( response.singleHeaders[ 'Set-Cookie' ] ).toContain( 'SameSite=Strict' )
        } )
    } )


    describe( 'body parsing', () => {
        test( 'returns 500 for invalid JSON body', async () => {
            const request = new EventEmitter()
            request.method = 'POST'
            request.url = '/api/validate'
            request.headers = {}
            request.destroy = jest.fn()

            process.nextTick( () => {
                request.emit( 'data', Buffer.from( 'not json' ) )
                request.emit( 'end' )
            } )

            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 500 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'Invalid JSON' )
        } )


        test( 'rejects body exceeding size limit', async () => {
            const request = new EventEmitter()
            request.method = 'POST'
            request.url = '/api/validate'
            request.headers = {}
            request.destroy = jest.fn()

            const largeChunk = Buffer.alloc( 1048577, 'a' )

            process.nextTick( () => {
                request.emit( 'data', largeChunk )
            } )

            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 500 )
            expect( request.destroy ).toHaveBeenCalled()

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'too large' )
        } )
    } )
} )
