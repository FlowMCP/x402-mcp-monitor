import { jest } from '@jest/globals'


const mockValidatorStart = jest.fn()

jest.unstable_mockModule( 'x402-mcp-validator', () => ( {
    McpServerValidator: {
        start: mockValidatorStart
    }
} ) )

const { McpProbe } = await import( '../../src/prober/McpProbe.mjs' )


describe( 'McpProbe', () => {
    const originalFetch = globalThis.fetch


    afterEach( () => {
        globalThis.fetch = originalFetch
        mockValidatorStart.mockReset()
    } )


    describe( 'probe', () => {
        test( 'returns probe result for healthy MCP server', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( { ok: true } )

            mockValidatorStart.mockResolvedValue( {
                status: true,
                messages: [],
                categories: {
                    supportsX402: true,
                    hasValidPaymentRequirements: true,
                    supportsExactScheme: true,
                    supportsEvm: true,
                    supportsSolana: false
                },
                entries: {
                    serverName: 'test-server',
                    serverVersion: '1.0.0',
                    tools: [ { name: 'tool1' }, { name: 'tool2' } ],
                    resources: [],
                    prompts: [],
                    x402: {
                        tools: [ { name: 'paid-tool' } ],
                        networks: [ 'eip155:8453' ],
                        schemes: [ 'exact' ]
                    }
                }
            } )

            const { probeResult } = await McpProbe.probe( {
                endpoint: 'https://mcp.test.com/mcp',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'isReachable' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsMcp' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasTools' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsX402' ] ).toBe( true )
            expect( probeResult[ 'summary' ][ 'toolCount' ] ).toBe( 2 )
            expect( probeResult[ 'summary' ][ 'x402ToolCount' ] ).toBe( 1 )
            expect( probeResult[ 'summary' ][ 'networks' ] ).toEqual( [ 'eip155:8453' ] )
        } )


        test( 'handles unreachable server', async () => {
            globalThis.fetch = jest.fn().mockRejectedValue( new Error( 'ECONNREFUSED' ) )

            mockValidatorStart.mockRejectedValue( new Error( 'Connection failed' ) )

            const { probeResult } = await McpProbe.probe( {
                endpoint: 'https://dead.server.com/mcp',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'isReachable' ] ).toBe( false )
            expect( probeResult[ 'messages' ] ).toHaveLength( 1 )
        } )


        test( 'handles server without x402', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( { ok: true } )

            mockValidatorStart.mockResolvedValue( {
                status: true,
                messages: [],
                categories: {
                    supportsX402: false,
                    hasValidPaymentRequirements: false,
                    supportsExactScheme: false,
                    supportsEvm: false,
                    supportsSolana: false
                },
                entries: {
                    serverName: 'basic-server',
                    serverVersion: '1.0.0',
                    tools: [ { name: 'free-tool' } ],
                    resources: [],
                    prompts: [],
                    x402: null
                }
            } )

            const { probeResult } = await McpProbe.probe( {
                endpoint: 'https://free.server.com/mcp',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsX402' ] ).toBe( false )
            expect( probeResult[ 'summary' ][ 'x402ToolCount' ] ).toBe( 0 )
        } )


        test( 'throws on missing endpoint', async () => {
            await expect(
                McpProbe.probe( { timeout: 5000 } )
            ).rejects.toThrow( 'endpoint: Missing value' )
        } )


        test( 'throws on invalid timeout', async () => {
            await expect(
                McpProbe.probe( { endpoint: 'https://test.com', timeout: -1 } )
            ).rejects.toThrow( 'timeout: Must be greater than 0' )
        } )
    } )
} )
