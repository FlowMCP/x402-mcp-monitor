import { EventEmitter } from 'node:events'
import { jest } from '@jest/globals'


let requestHandler
let McpAgentAssessment


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


beforeAll( async () => {
    jest.spyOn( console, 'log' ).mockImplementation( () => {} )

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
        test( 'returns legacy format validation result for valid URL', async () => {
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
            expect( data.mcp ).toBeDefined()
            expect( data.a2a ).toBeDefined()
            expect( data.ui ).toBeDefined()
            expect( data.mcp.status ).toBe( true )
            expect( data.mcp.summary.serverName ).toBe( 'Test Server' )
            expect( data.mcp.tools ).toHaveLength( 1 )
            expect( data.mcp.categories.supportsX402 ).toBe( true )
            expect( data.a2a.status ).toBe( false )
            expect( data.ui.status ).toBe( false )
            expect( data.ui.categories.supportsMcpApps ).toBe( false )
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


        test( 'filters A2A internal error messages in legacy format', async () => {
            const assessmentWithA2aErrors = {
                ...MOCK_ASSESSMENT,
                layers: {
                    ...MOCK_ASSESSMENT.layers,
                    a2a: {
                        status: false,
                        messages: [ 'Cannot read properties of null', 'Not an A2A endpoint' ],
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
            expect( data.a2a.messages ).toHaveLength( 1 )
            expect( data.a2a.messages[ 0 ] ).toBe( 'Not an A2A endpoint' )
        } )


        test( 'returns UI data in legacy format when MCP Apps are active', async () => {
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
            expect( data.ui ).toBeDefined()
            expect( data.ui.status ).toBe( true )
            expect( data.ui.categories.supportsMcpApps ).toBe( true )
            expect( data.ui.categories.hasUiResources ).toBe( true )
            expect( data.ui.categories.hasToolLinkage ).toBe( true )
            expect( data.ui.categories.supportsTheming ).toBe( true )
            expect( data.ui.summary.extensionVersion ).toBe( '1.0.0' )
            expect( data.ui.summary.uiResourceCount ).toBe( 2 )
            expect( data.ui.summary.uiLinkedToolCount ).toBe( 1 )
            expect( data.ui.summary.displayModes ).toEqual( [ 'embedded', 'fullscreen' ] )
            expect( data.ui.uiResources ).toHaveLength( 2 )
            expect( data.ui.uiLinkedTools ).toHaveLength( 1 )
            expect( data.ui.cspSummary ).toEqual( { defaultSrc: "'self'" } )
            expect( data.ui.permissionsSummary ).toEqual( [ 'clipboard-read', 'geolocation' ] )
            expect( data.ui.messages ).toHaveLength( 1 )
            expect( data.ui.messages[ 0 ] ).toBe( 'UI-001 ui: Found 2 UI resources' )
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
