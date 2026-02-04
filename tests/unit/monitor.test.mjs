import { jest } from '@jest/globals'
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'


const mockMcpCollect = jest.fn()
const mockErc8004Collect = jest.fn()
const mockBazaarCollect = jest.fn()
const mockManualCollect = jest.fn()
const mockProbeAll = jest.fn()

jest.unstable_mockModule( '../../src/collector/McpRegistryCollector.mjs', () => ( {
    McpRegistryCollector: { collect: mockMcpCollect }
} ) )

jest.unstable_mockModule( '../../src/collector/Erc8004Collector.mjs', () => ( {
    Erc8004Collector: { collect: mockErc8004Collect }
} ) )

jest.unstable_mockModule( '../../src/collector/BazaarCollector.mjs', () => ( {
    BazaarCollector: { collect: mockBazaarCollect }
} ) )

jest.unstable_mockModule( '../../src/collector/ManualCollector.mjs', () => ( {
    ManualCollector: { collect: mockManualCollect }
} ) )

jest.unstable_mockModule( '../../src/prober/EndpointProber.mjs', () => ( {
    EndpointProber: { probeAll: mockProbeAll }
} ) )

const { Monitor } = await import( '../../src/Monitor.mjs' )


const TEST_BASE = join( new URL( '.', import.meta.url ).pathname, '..', 'tmp-monitor-test' )
const TEST_DATA_PATH = join( TEST_BASE, 'data' )
const TEST_DOCS_PATH = join( TEST_BASE, 'docs' )


describe( 'Monitor', () => {
    beforeEach( async () => {
        await mkdir( TEST_DATA_PATH, { recursive: true } )
        await mkdir( TEST_DOCS_PATH, { recursive: true } )

        const defaultState = {
            version: 1,
            updatedAt: null,
            cursors: {
                'mcp-registry': { lastCursor: null, lastFetchedAt: null, totalFetched: 0 },
                'erc8004': { lastProcessedBlock: 24339925, lastFetchedAt: null, genesisBlock: 24339925, contract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' },
                'bazaar': { lastOffset: 0, lastFetchedAt: null, totalFetched: 0 }
            },
            probeMaxAgeDays: 7
        }

        const defaultEndpoints = {
            version: 1,
            updatedAt: null,
            stats: { total: 0, reachable: 0, withX402: 0, withTools: 0, bySource: {}, byProtocol: {} },
            endpoints: []
        }

        await writeFile( join( TEST_DATA_PATH, 'state.json' ), JSON.stringify( defaultState ), 'utf-8' )
        await writeFile( join( TEST_DATA_PATH, 'endpoints.json' ), JSON.stringify( defaultEndpoints ), 'utf-8' )
    } )


    afterEach( async () => {
        await rm( TEST_BASE, { recursive: true, force: true } )
        mockMcpCollect.mockReset()
        mockErc8004Collect.mockReset()
        mockBazaarCollect.mockReset()
        mockManualCollect.mockReset()
        mockProbeAll.mockReset()
    } )


    describe( 'collect', () => {
        test( 'runs full pipeline with discoveries', async () => {
            mockMcpCollect.mockResolvedValue( {
                status: true,
                discoveries: [
                    {
                        url: 'https://mcp.test.com/mcp',
                        protocol: 'mcp',
                        sourceData: { type: 'mcp-registry', serverName: 'test', discoveredAt: '2026-02-04T12:00:00.000Z' }
                    }
                ],
                cursor: null,
                totalFetched: 1,
                error: null
            } )

            mockErc8004Collect.mockResolvedValue( {
                status: true,
                discoveries: [],
                lastProcessedBlock: 24340000,
                error: null
            } )

            mockBazaarCollect.mockResolvedValue( {
                status: true,
                discoveries: [],
                totalFetched: 0,
                error: null
            } )

            mockManualCollect.mockResolvedValue( {
                status: true,
                discoveries: [],
                totalFetched: 0,
                error: null
            } )

            mockProbeAll.mockImplementation( async ( { endpoints } ) => ( {
                endpoints,
                probedCount: endpoints.length
            } ) )

            const result = await Monitor.collect( {
                dataPath: TEST_DATA_PATH,
                alchemyUrl: 'https://eth-mainnet.g.alchemy.com/v2/test',
                probeMaxConcurrency: 2,
                probeTimeoutMs: 5000,
                probeMaxAgeDays: 7
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'stats' ][ 'total' ] ).toBe( 1 )
            expect( result[ 'newEndpoints' ] ).toBe( 1 )
            expect( result[ 'probedCount' ] ).toBe( 1 )

            const endpointsRaw = await readFile( join( TEST_DATA_PATH, 'endpoints.json' ), 'utf-8' )
            const endpointsData = JSON.parse( endpointsRaw )

            expect( endpointsData[ 'endpoints' ] ).toHaveLength( 1 )
            expect( endpointsData[ 'endpoints' ][ 0 ][ 'url' ] ).toBe( 'https://mcp.test.com/mcp' )

            const dashboardRaw = await readFile( join( TEST_DOCS_PATH, 'data.json' ), 'utf-8' )
            const dashboardData = JSON.parse( dashboardRaw )

            expect( dashboardData[ 'endpoints' ] ).toHaveLength( 1 )
        } )


        test( 'handles collector failures gracefully', async () => {
            mockMcpCollect.mockResolvedValue( {
                status: false,
                discoveries: [],
                cursor: null,
                totalFetched: 0,
                error: 'Registry unavailable'
            } )

            mockErc8004Collect.mockResolvedValue( {
                status: false,
                discoveries: [],
                lastProcessedBlock: 24339925,
                error: 'RPC down'
            } )

            mockBazaarCollect.mockResolvedValue( {
                status: false,
                discoveries: [],
                totalFetched: 0,
                error: 'Bazaar 500'
            } )

            mockManualCollect.mockResolvedValue( {
                status: true,
                discoveries: [],
                totalFetched: 0,
                error: null
            } )

            mockProbeAll.mockImplementation( async ( { endpoints } ) => ( {
                endpoints,
                probedCount: 0
            } ) )

            const result = await Monitor.collect( {
                dataPath: TEST_DATA_PATH,
                alchemyUrl: 'https://eth-mainnet.g.alchemy.com/v2/test',
                probeMaxConcurrency: 2,
                probeTimeoutMs: 5000,
                probeMaxAgeDays: 7
            } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'stats' ][ 'total' ] ).toBe( 0 )
            expect( result[ 'log' ] ).toEqual(
                expect.arrayContaining( [
                    expect.stringContaining( 'FAILED' )
                ] )
            )
        } )


        test( 'throws on missing dataPath', async () => {
            await expect(
                Monitor.collect( {
                    alchemyUrl: 'https://test.com',
                    probeMaxConcurrency: 2,
                    probeTimeoutMs: 5000,
                    probeMaxAgeDays: 7
                } )
            ).rejects.toThrow( 'dataPath: Missing value' )
        } )


        test( 'throws on missing alchemyUrl', async () => {
            await expect(
                Monitor.collect( {
                    dataPath: TEST_DATA_PATH,
                    probeMaxConcurrency: 2,
                    probeTimeoutMs: 5000,
                    probeMaxAgeDays: 7
                } )
            ).rejects.toThrow( 'alchemyUrl: Missing value' )
        } )
    } )
} )
