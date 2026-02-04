import { readFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { DashboardBuilder } from '../../src/writer/DashboardBuilder.mjs'


const TEST_DOCS_PATH = join( new URL( '.', import.meta.url ).pathname, '..', 'tmp-dashboard-test' )


describe( 'DashboardBuilder', () => {
    beforeEach( async () => {
        await mkdir( TEST_DOCS_PATH, { recursive: true } )
    } )


    afterEach( async () => {
        await rm( TEST_DOCS_PATH, { recursive: true, force: true } )
    } )


    describe( 'buildDashboardData', () => {
        test( 'builds dashboard data from endpoints', () => {
            const endpointsData = {
                updatedAt: '2026-02-04T12:00:00.000Z',
                stats: { total: 2, reachable: 1, withX402: 1 },
                endpoints: [
                    {
                        id: 'ep_1',
                        url: 'https://mcp.test.com',
                        protocol: 'mcp',
                        sources: [
                            { type: 'mcp-registry', serverName: 'test' },
                            { type: 'erc8004', agentId: '42' }
                        ],
                        probe: {
                            timestamp: '2026-02-04T12:00:00.000Z',
                            status: true,
                            categories: { isReachable: true, supportsX402: true },
                            summary: { serverName: 'test-server', toolCount: 3 },
                            messages: []
                        }
                    },
                    {
                        id: 'ep_2',
                        url: 'https://agent.test.com',
                        protocol: 'a2a',
                        sources: [ { type: 'erc8004', agentId: '99' } ],
                        probe: null
                    }
                ]
            }

            const { dashboardData } = DashboardBuilder.buildDashboardData( { endpointsData } )

            expect( dashboardData[ 'updatedAt' ] ).toBe( '2026-02-04T12:00:00.000Z' )
            expect( dashboardData[ 'stats' ][ 'total' ] ).toBe( 2 )
            expect( dashboardData[ 'endpoints' ] ).toHaveLength( 2 )

            const ep1 = dashboardData[ 'endpoints' ][ 0 ]
            expect( ep1[ 'sourceTypes' ] ).toEqual( [ 'mcp-registry', 'erc8004' ] )
            expect( ep1[ 'sourceCount' ] ).toBe( 2 )
            expect( ep1[ 'isReachable' ] ).toBe( true )
            expect( ep1[ 'supportsX402' ] ).toBe( true )
            expect( ep1[ 'probe' ][ 'summary' ][ 'toolCount' ] ).toBe( 3 )

            const ep2 = dashboardData[ 'endpoints' ][ 1 ]
            expect( ep2[ 'sourceTypes' ] ).toEqual( [ 'erc8004' ] )
            expect( ep2[ 'isReachable' ] ).toBe( false )
            expect( ep2[ 'probe' ] ).toBeNull()
        } )


        test( 'handles empty endpoints', () => {
            const endpointsData = {
                updatedAt: null,
                stats: { total: 0 },
                endpoints: []
            }

            const { dashboardData } = DashboardBuilder.buildDashboardData( { endpointsData } )

            expect( dashboardData[ 'endpoints' ] ).toHaveLength( 0 )
        } )


        test( 'throws on missing endpointsData', () => {
            expect( () => {
                DashboardBuilder.buildDashboardData( {} )
            } ).toThrow( 'endpointsData: Missing value' )
        } )
    } )


    describe( 'writeDashboardData', () => {
        test( 'writes data.json to docs path', async () => {
            const dashboardData = {
                updatedAt: '2026-02-04T12:00:00.000Z',
                stats: { total: 1 },
                endpoints: [ { id: 'ep_1' } ]
            }

            const { written } = await DashboardBuilder.writeDashboardData( {
                docsPath: TEST_DOCS_PATH,
                dashboardData
            } )

            expect( written ).toBe( true )

            const raw = await readFile( join( TEST_DOCS_PATH, 'data.json' ), 'utf-8' )
            const parsed = JSON.parse( raw )

            expect( parsed[ 'stats' ][ 'total' ] ).toBe( 1 )
        } )
    } )
} )
