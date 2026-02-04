import { EndpointRegistry } from '../../src/registry/EndpointRegistry.mjs'
import { EndpointNormalizer } from '../../src/registry/EndpointNormalizer.mjs'


describe( 'EndpointRegistry', () => {
    describe( 'merge', () => {
        test( 'creates new endpoint from discovery', () => {
            const newDiscoveries = [
                {
                    url: 'https://mcp.example.com/mcp',
                    protocol: 'mcp',
                    sourceData: {
                        type: 'mcp-registry',
                        serverName: 'io.github.user/weather',
                        discoveredAt: '2026-02-01T10:00:00.000Z'
                    }
                }
            ]

            const { endpoints } = EndpointRegistry.merge( {
                existingEndpoints: [],
                newDiscoveries
            } )

            expect( endpoints ).toHaveLength( 1 )
            expect( endpoints[ 0 ][ 'url' ] ).toBe( 'https://mcp.example.com/mcp' )
            expect( endpoints[ 0 ][ 'protocol' ] ).toBe( 'mcp' )
            expect( endpoints[ 0 ][ 'sources' ] ).toHaveLength( 1 )
            expect( endpoints[ 0 ][ 'sources' ][ 0 ][ 'type' ] ).toBe( 'mcp-registry' )
            expect( endpoints[ 0 ][ 'probe' ] ).toBeNull()
            expect( endpoints[ 0 ][ 'id' ] ).toMatch( /^ep_[a-f0-9]{8}$/ )
        } )


        test( 'merges source into existing endpoint', () => {
            const { id } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/mcp' } )

            const existingEndpoints = [
                {
                    id,
                    url: 'https://mcp.example.com/mcp',
                    protocol: 'mcp',
                    sources: [
                        {
                            type: 'mcp-registry',
                            serverName: 'io.github.user/weather',
                            discoveredAt: '2026-02-01T10:00:00.000Z'
                        }
                    ],
                    probe: null
                }
            ]

            const newDiscoveries = [
                {
                    url: 'https://mcp.example.com/mcp',
                    protocol: 'mcp',
                    sourceData: {
                        type: 'erc8004',
                        agentId: '42',
                        discoveredAt: '2026-02-02T06:00:00.000Z'
                    }
                }
            ]

            const { endpoints } = EndpointRegistry.merge( {
                existingEndpoints,
                newDiscoveries
            } )

            expect( endpoints ).toHaveLength( 1 )
            expect( endpoints[ 0 ][ 'sources' ] ).toHaveLength( 2 )
            expect( endpoints[ 0 ][ 'sources' ][ 0 ][ 'type' ] ).toBe( 'mcp-registry' )
            expect( endpoints[ 0 ][ 'sources' ][ 1 ][ 'type' ] ).toBe( 'erc8004' )
        } )


        test( 'updates existing source of same type', () => {
            const { id } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/mcp' } )

            const existingEndpoints = [
                {
                    id,
                    url: 'https://mcp.example.com/mcp',
                    protocol: 'mcp',
                    sources: [
                        {
                            type: 'mcp-registry',
                            serverName: 'old-name',
                            discoveredAt: '2026-01-01T00:00:00.000Z'
                        }
                    ],
                    probe: null
                }
            ]

            const newDiscoveries = [
                {
                    url: 'https://mcp.example.com/mcp',
                    protocol: 'mcp',
                    sourceData: {
                        type: 'mcp-registry',
                        serverName: 'new-name',
                        discoveredAt: '2026-02-01T00:00:00.000Z'
                    }
                }
            ]

            const { endpoints } = EndpointRegistry.merge( {
                existingEndpoints,
                newDiscoveries
            } )

            expect( endpoints ).toHaveLength( 1 )
            expect( endpoints[ 0 ][ 'sources' ] ).toHaveLength( 1 )
            expect( endpoints[ 0 ][ 'sources' ][ 0 ][ 'serverName' ] ).toBe( 'new-name' )
        } )


        test( 'deduplicates by normalized url', () => {
            const newDiscoveries = [
                {
                    url: 'https://MCP.EXAMPLE.COM/mcp/',
                    protocol: 'mcp',
                    sourceData: { type: 'mcp-registry', discoveredAt: '2026-02-01T00:00:00.000Z' }
                },
                {
                    url: 'https://mcp.example.com/mcp',
                    protocol: 'mcp',
                    sourceData: { type: 'erc8004', discoveredAt: '2026-02-02T00:00:00.000Z' }
                }
            ]

            const { endpoints } = EndpointRegistry.merge( {
                existingEndpoints: [],
                newDiscoveries
            } )

            expect( endpoints ).toHaveLength( 1 )
            expect( endpoints[ 0 ][ 'sources' ] ).toHaveLength( 2 )
        } )


        test( 'preserves existing probe data', () => {
            const { id } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/mcp' } )
            const probeData = { timestamp: '2026-02-04T12:00:00.000Z', status: true, categories: {} }

            const existingEndpoints = [
                {
                    id,
                    url: 'https://mcp.example.com/mcp',
                    protocol: 'mcp',
                    sources: [ { type: 'mcp-registry', discoveredAt: '2026-02-01T00:00:00.000Z' } ],
                    probe: probeData
                }
            ]

            const newDiscoveries = [
                {
                    url: 'https://mcp.example.com/mcp',
                    protocol: 'mcp',
                    sourceData: { type: 'erc8004', discoveredAt: '2026-02-02T00:00:00.000Z' }
                }
            ]

            const { endpoints } = EndpointRegistry.merge( {
                existingEndpoints,
                newDiscoveries
            } )

            expect( endpoints[ 0 ][ 'probe' ] ).toEqual( probeData )
        } )


        test( 'throws on missing existingEndpoints', () => {
            expect( () => {
                EndpointRegistry.merge( { newDiscoveries: [] } )
            } ).toThrow( 'existingEndpoints: Missing value' )
        } )


        test( 'throws on missing newDiscoveries', () => {
            expect( () => {
                EndpointRegistry.merge( { existingEndpoints: [] } )
            } ).toThrow( 'newDiscoveries: Missing value' )
        } )
    } )


    describe( 'computeStats', () => {
        test( 'computes stats for empty list', () => {
            const { stats } = EndpointRegistry.computeStats( { endpoints: [] } )

            expect( stats[ 'total' ] ).toBe( 0 )
            expect( stats[ 'reachable' ] ).toBe( 0 )
            expect( stats[ 'withX402' ] ).toBe( 0 )
            expect( stats[ 'withTools' ] ).toBe( 0 )
        } )


        test( 'counts by protocol', () => {
            const endpoints = [
                { protocol: 'mcp', sources: [], probe: null },
                { protocol: 'mcp', sources: [], probe: null },
                { protocol: 'a2a', sources: [], probe: null }
            ]

            const { stats } = EndpointRegistry.computeStats( { endpoints } )

            expect( stats[ 'byProtocol' ][ 'mcp' ] ).toBe( 2 )
            expect( stats[ 'byProtocol' ][ 'a2a' ] ).toBe( 1 )
        } )


        test( 'counts by source', () => {
            const endpoints = [
                {
                    protocol: 'mcp',
                    sources: [
                        { type: 'mcp-registry' },
                        { type: 'erc8004' }
                    ],
                    probe: null
                },
                {
                    protocol: 'mcp',
                    sources: [ { type: 'erc8004' } ],
                    probe: null
                }
            ]

            const { stats } = EndpointRegistry.computeStats( { endpoints } )

            expect( stats[ 'bySource' ][ 'mcp-registry' ] ).toBe( 1 )
            expect( stats[ 'bySource' ][ 'erc8004' ] ).toBe( 2 )
        } )


        test( 'counts reachable endpoints', () => {
            const endpoints = [
                {
                    protocol: 'mcp',
                    sources: [],
                    probe: {
                        status: true,
                        categories: { isReachable: true, supportsX402: false, hasTools: true }
                    }
                },
                {
                    protocol: 'mcp',
                    sources: [],
                    probe: {
                        status: true,
                        categories: { isReachable: false, supportsX402: false, hasTools: false }
                    }
                },
                {
                    protocol: 'mcp',
                    sources: [],
                    probe: null
                }
            ]

            const { stats } = EndpointRegistry.computeStats( { endpoints } )

            expect( stats[ 'reachable' ] ).toBe( 1 )
            expect( stats[ 'withTools' ] ).toBe( 1 )
        } )


        test( 'counts x402 endpoints', () => {
            const endpoints = [
                {
                    protocol: 'mcp',
                    sources: [],
                    probe: {
                        status: true,
                        categories: { isReachable: true, supportsX402: true, hasTools: true }
                    }
                }
            ]

            const { stats } = EndpointRegistry.computeStats( { endpoints } )

            expect( stats[ 'withX402' ] ).toBe( 1 )
        } )


        test( 'counts a2a skills as tools', () => {
            const endpoints = [
                {
                    protocol: 'a2a',
                    sources: [],
                    probe: {
                        status: true,
                        categories: { isReachable: true, hasSkills: true }
                    }
                }
            ]

            const { stats } = EndpointRegistry.computeStats( { endpoints } )

            expect( stats[ 'withTools' ] ).toBe( 1 )
        } )
    } )
} )
