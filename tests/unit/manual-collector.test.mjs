import { rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ManualCollector } from '../../src/collector/ManualCollector.mjs'


const TEST_DATA_PATH = join( new URL( '.', import.meta.url ).pathname, '..', 'tmp-manual-test' )


describe( 'ManualCollector', () => {
    beforeEach( async () => {
        await mkdir( TEST_DATA_PATH, { recursive: true } )
    } )


    afterEach( async () => {
        await rm( TEST_DATA_PATH, { recursive: true, force: true } )
    } )


    describe( 'collect', () => {
        test( 'collects endpoints from manual.json', async () => {
            const manualData = {
                version: 1,
                endpoints: [
                    {
                        url: 'https://x402.flowmcp.com',
                        protocol: 'mcp',
                        name: 'FlowMCP x402 Server',
                        description: 'FlowMCP x402-enabled MCP server',
                        addedAt: '2026-02-04T05:00:00.000Z'
                    },
                    {
                        url: 'https://another.server.com/mcp',
                        protocol: 'mcp',
                        name: 'Another Server',
                        description: null,
                        addedAt: '2026-02-04T05:00:00.000Z'
                    }
                ]
            }

            await writeFile( join( TEST_DATA_PATH, 'manual.json' ), JSON.stringify( manualData ), 'utf-8' )

            const result = await ManualCollector.collect( { dataPath: TEST_DATA_PATH } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 2 )
            expect( result[ 'discoveries' ][ 0 ][ 'url' ] ).toBe( 'https://x402.flowmcp.com' )
            expect( result[ 'discoveries' ][ 0 ][ 'protocol' ] ).toBe( 'mcp' )
            expect( result[ 'discoveries' ][ 0 ][ 'sourceData' ][ 'type' ] ).toBe( 'manual' )
            expect( result[ 'discoveries' ][ 0 ][ 'sourceData' ][ 'name' ] ).toBe( 'FlowMCP x402 Server' )
        } )


        test( 'skips entries with empty URLs', async () => {
            const manualData = {
                version: 1,
                endpoints: [
                    { url: '', protocol: 'mcp', name: 'Empty' },
                    { url: null, protocol: 'mcp', name: 'Null' },
                    { protocol: 'mcp', name: 'Missing' }
                ]
            }

            await writeFile( join( TEST_DATA_PATH, 'manual.json' ), JSON.stringify( manualData ), 'utf-8' )

            const result = await ManualCollector.collect( { dataPath: TEST_DATA_PATH } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )


        test( 'defaults protocol to mcp when not specified', async () => {
            const manualData = {
                version: 1,
                endpoints: [
                    { url: 'https://test.com', name: 'No Protocol' }
                ]
            }

            await writeFile( join( TEST_DATA_PATH, 'manual.json' ), JSON.stringify( manualData ), 'utf-8' )

            const result = await ManualCollector.collect( { dataPath: TEST_DATA_PATH } )

            expect( result[ 'discoveries' ][ 0 ][ 'protocol' ] ).toBe( 'mcp' )
        } )


        test( 'returns empty when file does not exist', async () => {
            const result = await ManualCollector.collect( { dataPath: TEST_DATA_PATH } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )


        test( 'returns empty when file is corrupt', async () => {
            await writeFile( join( TEST_DATA_PATH, 'manual.json' ), 'not-json', 'utf-8' )

            const result = await ManualCollector.collect( { dataPath: TEST_DATA_PATH } )

            expect( result[ 'status' ] ).toBe( true )
            expect( result[ 'discoveries' ] ).toHaveLength( 0 )
        } )
    } )
} )
