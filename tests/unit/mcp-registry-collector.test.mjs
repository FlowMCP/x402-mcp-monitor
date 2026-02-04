import { jest } from '@jest/globals'

import { McpRegistryCollector } from '../../src/collector/McpRegistryCollector.mjs'


const MOCK_SERVER_ENTRY = {
    _meta: {
        'io.modelcontextprotocol.registry/official': {
            isLatest: true,
            publishedAt: '2026-02-01T10:00:00.000Z',
            status: 'active',
            updatedAt: '2026-02-01T10:00:00.000Z'
        }
    },
    server: {
        name: 'io.github.user/weather',
        version: '1.0.2',
        description: 'Weather API MCP server',
        remotes: [
            {
                type: 'streamable-http',
                url: 'https://mcp.weather.com/mcp'
            }
        ]
    }
}


const MOCK_SERVER_STDIO_ONLY = {
    _meta: {
        'io.modelcontextprotocol.registry/official': { status: 'active' }
    },
    server: {
        name: 'io.github.user/local-only',
        version: '1.0.0',
        description: 'Local only server',
        remotes: [
            { type: 'stdio', url: null }
        ]
    }
}


const MOCK_SERVER_NO_REMOTES = {
    _meta: {
        'io.modelcontextprotocol.registry/official': { status: 'active' }
    },
    server: {
        name: 'io.github.user/no-remotes',
        version: '1.0.0',
        description: 'No remotes',
        remotes: null
    }
}


const MOCK_SERVER_TEMPLATE_URL = {
    _meta: {
        'io.modelcontextprotocol.registry/official': { status: 'active' }
    },
    server: {
        name: 'io.github.user/templated',
        version: '1.0.0',
        description: 'Has template url',
        remotes: [
            { type: 'streamable-http', url: 'https://{{SERVER_HOST}}/mcp' }
        ]
    }
}


describe( 'McpRegistryCollector', () => {
    const originalFetch = globalThis.fetch


    afterEach( () => {
        globalThis.fetch = originalFetch
    } )


    describe( 'collect', () => {
        test( 'collects servers with remote URLs', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                json: async () => ( {
                    metadata: { count: 1, nextCursor: null },
                    servers: [ MOCK_SERVER_ENTRY ]
                } )
            } )

            const result = await McpRegistryCollector.collect( {
                registryUrl: 'https://registry.test.com'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 1 )
            expect( result[ 'discoveries' ][ 0 ][ 'url' ] ).toBe( 'https://mcp.weather.com/mcp' )
            expect( result[ 'discoveries' ][ 0 ][ 'protocol' ] ).toBe( 'mcp' )
            expect( result[ 'discoveries' ][ 0 ][ 'sourceData' ][ 'type' ] ).toBe( 'mcp-registry' )
            expect( result[ 'discoveries' ][ 0 ][ 'sourceData' ][ 'serverName' ] ).toBe( 'io.github.user/weather' )
        } )


        test( 'skips servers with stdio-only remotes', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                json: async () => ( {
                    metadata: { count: 1, nextCursor: null },
                    servers: [ MOCK_SERVER_STDIO_ONLY ]
                } )
            } )

            const result = await McpRegistryCollector.collect( {
                registryUrl: 'https://registry.test.com'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )


        test( 'skips servers with null remotes', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                json: async () => ( {
                    metadata: { count: 1, nextCursor: null },
                    servers: [ MOCK_SERVER_NO_REMOTES ]
                } )
            } )

            const result = await McpRegistryCollector.collect( {
                registryUrl: 'https://registry.test.com'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )


        test( 'skips servers with template URLs', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                json: async () => ( {
                    metadata: { count: 1, nextCursor: null },
                    servers: [ MOCK_SERVER_TEMPLATE_URL ]
                } )
            } )

            const result = await McpRegistryCollector.collect( {
                registryUrl: 'https://registry.test.com'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )


        test( 'paginates through multiple pages', async () => {
            let callCount = 0
            globalThis.fetch = jest.fn().mockImplementation( async () => {
                callCount += 1

                if( callCount === 1 ) {
                    return {
                        ok: true,
                        json: async () => ( {
                            metadata: { count: 1, nextCursor: 'cursor-2' },
                            servers: [ MOCK_SERVER_ENTRY ]
                        } )
                    }
                }

                return {
                    ok: true,
                    json: async () => ( {
                        metadata: { count: 0, nextCursor: null },
                        servers: []
                    } )
                }
            } )

            const result = await McpRegistryCollector.collect( {
                registryUrl: 'https://registry.test.com'
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 1 )
            expect( callCount ).toBe( 2 )
        } )


        test( 'returns error on API failure', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: false,
                status: 503
            } )

            const result = await McpRegistryCollector.collect( {
                registryUrl: 'https://registry.test.com'
            } )

            expect( result[ 'status' ] ).toBe( false )
            expect( result[ 'error' ] ).toContain( '503' )
        } )


        test( 'returns error on network failure', async () => {
            globalThis.fetch = jest.fn().mockRejectedValue( new Error( 'Network error' ) )

            const result = await McpRegistryCollector.collect( {
                registryUrl: 'https://registry.test.com'
            } )

            expect( result[ 'status' ] ).toBe( false )
            expect( result[ 'error' ] ).toBe( 'Network error' )
        } )


        test( 'throws on non-string registryUrl', async () => {
            await expect(
                McpRegistryCollector.collect( { registryUrl: 123 } )
            ).rejects.toThrow( 'registryUrl: Must be a string' )
        } )
    } )
} )
