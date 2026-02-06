import { EventEmitter } from 'node:events'
import { jest } from '@jest/globals'


let requestHandler
let McpServerValidator
let A2aProbe
let Erc8004RegistryParser
let originalFetch


function createMockRequest( { method, url, body = null } ) {
    const req = new EventEmitter()
    req.method = method
    req.url = url
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
        body: null,
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


beforeAll( async () => {
    jest.spyOn( console, 'log' ).mockImplementation( () => {} )

    jest.unstable_mockModule( 'node:http', () => ( {
        createServer: jest.fn( ( handler ) => {
            requestHandler = handler

            return { listen: jest.fn( ( _port, cb ) => { if( cb ) cb() } ) }
        } )
    } ) )

    jest.unstable_mockModule( 'x402-mcp-validator', () => ( {
        McpServerValidator: { start: jest.fn() }
    } ) )

    jest.unstable_mockModule( '../../src/prober/A2aProbe.mjs', () => ( {
        A2aProbe: { probe: jest.fn() }
    } ) )

    jest.unstable_mockModule( 'erc8004-registry-parser', () => ( {
        Erc8004RegistryParser: { validateFromUri: jest.fn() }
    } ) )

    originalFetch = globalThis.fetch
    globalThis.fetch = jest.fn( () => Promise.resolve( { status: 200 } ) )

    const validatorMod = await import( 'x402-mcp-validator' )
    McpServerValidator = validatorMod.McpServerValidator

    const a2aMod = await import( '../../src/prober/A2aProbe.mjs' )
    A2aProbe = a2aMod.A2aProbe

    const erc8004Mod = await import( 'erc8004-registry-parser' )
    Erc8004RegistryParser = erc8004Mod.Erc8004RegistryParser

    await import( '../../src/server/Server.mjs' )
} )


afterAll( () => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
} )


beforeEach( () => {
    McpServerValidator.start.mockReset()
    A2aProbe.probe.mockReset()
    Erc8004RegistryParser.validateFromUri.mockReset()
    globalThis.fetch = jest.fn( () => Promise.resolve( { status: 200 } ) )
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
            expect( response.headers[ 'Access-Control-Allow-Headers' ] ).toBe( 'Content-Type' )
            expect( response.headers[ 'Access-Control-Max-Age' ] ).toBe( '86400' )
        } )
    } )


    describe( 'POST /api/validate', () => {
        test( 'returns validation result for valid URL', async () => {
            McpServerValidator.start.mockResolvedValue( {
                status: true,
                messages: [],
                categories: { supportsX402: true, hasValidPaymentRequirements: true },
                entries: {
                    serverName: 'Test Server',
                    serverVersion: '1.0',
                    tools: [ { name: 'tool1' } ],
                    resources: [],
                    prompts: [],
                    x402: {
                        tools: [ { name: 'tool1' } ],
                        networks: [ 'base' ],
                        schemes: [ 'exact' ],
                        paymentRequirements: []
                    }
                }
            } )

            A2aProbe.probe.mockResolvedValue( {
                probeResult: { status: false, messages: [ 'Not A2A' ], categories: {} }
            } )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/validate',
                body: { url: 'https://example.com/mcp' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )

            const data = JSON.parse( response.body )
            expect( data.mcp.status ).toBe( true )
            expect( data.mcp.summary.serverName ).toBe( 'Test Server' )
            expect( data.mcp.tools ).toHaveLength( 1 )
            expect( data.a2a ).toBeDefined()
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


        test( 'filters A2A internal error messages', async () => {
            McpServerValidator.start.mockResolvedValue( {
                status: true,
                messages: [],
                categories: {},
                entries: {
                    serverName: 'Test',
                    serverVersion: '1.0',
                    tools: [],
                    resources: [],
                    prompts: [],
                    x402: null
                }
            } )

            A2aProbe.probe.mockResolvedValue( {
                probeResult: {
                    status: false,
                    messages: [ 'Cannot read properties of null', 'Not an A2A endpoint' ],
                    categories: {}
                }
            } )

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
    } )


    describe( 'POST /api/erc8004/validate', () => {
        test( 'returns validation result for valid registrationFile', async () => {
            Erc8004RegistryParser.validateFromUri.mockReturnValue( {
                status: true,
                messages: [],
                categories: { isSpecCompliant: true },
                entries: { name: 'Test Agent' }
            } )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/erc8004/validate',
                body: { registrationFile: { name: 'Test Agent', description: 'A test agent' } }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )

            const data = JSON.parse( response.body )
            expect( data.status ).toBe( true )
            expect( data.encodedUri ).toContain( 'data:application/json;base64,' )
        } )


        test( 'returns 400 for missing registrationFile', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/erc8004/validate',
                body: {}
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'registrationFile' )
        } )


        test( 'returns 400 when registrationFile is an array', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/erc8004/validate',
                body: { registrationFile: [ 1, 2, 3 ] }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'registrationFile' )
        } )


        test( 'returns 400 when registrationFile is a string', async () => {
            const request = createMockRequest( {
                method: 'POST',
                url: '/api/erc8004/validate',
                body: { registrationFile: 'not an object' }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 400 )

            const data = JSON.parse( response.body )
            expect( data.error ).toContain( 'registrationFile' )
        } )


        test( 'handles parser errors gracefully', async () => {
            Erc8004RegistryParser.validateFromUri.mockImplementation( () => {
                throw new Error( 'Parser crashed' )
            } )

            const request = createMockRequest( {
                method: 'POST',
                url: '/api/erc8004/validate',
                body: { registrationFile: { name: 'Test' } }
            } )
            const response = createMockResponse()

            await requestHandler( request, response )

            expect( response.statusCode ).toBe( 200 )

            const data = JSON.parse( response.body )
            expect( data.status ).toBe( false )
            expect( data.messages ).toContain( 'Parser crashed' )
        } )
    } )


    describe( 'body parsing', () => {
        test( 'returns 500 for invalid JSON body', async () => {
            const request = new EventEmitter()
            request.method = 'POST'
            request.url = '/api/validate'
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
