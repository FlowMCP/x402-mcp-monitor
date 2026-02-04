import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { StateManager } from '../../src/state/StateManager.mjs'


const TEST_DATA_PATH = join( new URL( '.', import.meta.url ).pathname, '..', 'tmp-state-test' )


describe( 'StateManager', () => {
    beforeEach( async () => {
        await mkdir( TEST_DATA_PATH, { recursive: true } )
    } )


    afterEach( async () => {
        await rm( TEST_DATA_PATH, { recursive: true, force: true } )
    } )


    describe( 'loadState', () => {
        test( 'loads existing state file', async () => {
            const testState = {
                version: 1,
                updatedAt: '2026-02-04T12:00:00.000Z',
                cursors: {
                    'mcp-registry': { lastCursor: 'abc', lastFetchedAt: '2026-02-04T12:00:00.000Z', totalFetched: 100 },
                    'erc8004': { lastProcessedBlock: 25000000, lastFetchedAt: '2026-02-04T12:00:00.000Z', genesisBlock: 24339925, contract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' },
                    'bazaar': { lastOffset: 0, lastFetchedAt: '2026-02-04T12:00:00.000Z', totalFetched: 25 }
                },
                probeMaxAgeDays: 7
            }

            await writeFile( join( TEST_DATA_PATH, 'state.json' ), JSON.stringify( testState ), 'utf-8' )

            const { state } = await StateManager.loadState( { dataPath: TEST_DATA_PATH } )

            expect( state[ 'version' ] ).toBe( 1 )
            expect( state[ 'cursors' ][ 'mcp-registry' ][ 'totalFetched' ] ).toBe( 100 )
            expect( state[ 'cursors' ][ 'erc8004' ][ 'lastProcessedBlock' ] ).toBe( 25000000 )
        } )


        test( 'returns default state when file does not exist', async () => {
            const { state } = await StateManager.loadState( { dataPath: TEST_DATA_PATH } )

            expect( state[ 'version' ] ).toBe( 1 )
            expect( state[ 'updatedAt' ] ).toBeNull()
            expect( state[ 'cursors' ][ 'erc8004' ][ 'lastProcessedBlock' ] ).toBe( 24339925 )
        } )


        test( 'returns default state when file is corrupt', async () => {
            await writeFile( join( TEST_DATA_PATH, 'state.json' ), 'not-json', 'utf-8' )

            const { state } = await StateManager.loadState( { dataPath: TEST_DATA_PATH } )

            expect( state[ 'version' ] ).toBe( 1 )
        } )


        test( 'throws on missing dataPath', async () => {
            await expect(
                StateManager.loadState( {} )
            ).rejects.toThrow( 'dataPath: Missing value' )
        } )
    } )


    describe( 'saveState', () => {
        test( 'writes state to file atomically', async () => {
            const testState = {
                version: 1,
                updatedAt: null,
                cursors: {
                    'mcp-registry': { lastCursor: null, lastFetchedAt: null, totalFetched: 0 },
                    'erc8004': { lastProcessedBlock: 24339925, lastFetchedAt: null, genesisBlock: 24339925, contract: '0x8004' },
                    'bazaar': { lastOffset: 0, lastFetchedAt: null, totalFetched: 0 }
                },
                probeMaxAgeDays: 7
            }

            const { state: savedState } = await StateManager.saveState( { dataPath: TEST_DATA_PATH, state: testState } )

            expect( savedState[ 'updatedAt' ] ).not.toBeNull()

            const raw = await readFile( join( TEST_DATA_PATH, 'state.json' ), 'utf-8' )
            const loaded = JSON.parse( raw )

            expect( loaded[ 'version' ] ).toBe( 1 )
            expect( loaded[ 'updatedAt' ] ).not.toBeNull()
        } )


        test( 'throws on missing dataPath', async () => {
            await expect(
                StateManager.saveState( { state: {} } )
            ).rejects.toThrow( 'dataPath: Missing value' )
        } )


        test( 'throws on missing state', async () => {
            await expect(
                StateManager.saveState( { dataPath: TEST_DATA_PATH } )
            ).rejects.toThrow( 'state: Missing value' )
        } )
    } )


    describe( 'loadEndpoints', () => {
        test( 'loads existing endpoints file', async () => {
            const testData = {
                version: 1,
                updatedAt: '2026-02-04T12:00:00.000Z',
                stats: { total: 5 },
                endpoints: [
                    { id: 'ep_abc12345', url: 'https://example.com' }
                ]
            }

            await writeFile( join( TEST_DATA_PATH, 'endpoints.json' ), JSON.stringify( testData ), 'utf-8' )

            const { endpointsData } = await StateManager.loadEndpoints( { dataPath: TEST_DATA_PATH } )

            expect( endpointsData[ 'endpoints' ] ).toHaveLength( 1 )
            expect( endpointsData[ 'endpoints' ][ 0 ][ 'id' ] ).toBe( 'ep_abc12345' )
        } )


        test( 'returns default when file does not exist', async () => {
            const { endpointsData } = await StateManager.loadEndpoints( { dataPath: TEST_DATA_PATH } )

            expect( endpointsData[ 'endpoints' ] ).toHaveLength( 0 )
            expect( endpointsData[ 'version' ] ).toBe( 1 )
        } )


        test( 'throws on missing dataPath', async () => {
            await expect(
                StateManager.loadEndpoints( {} )
            ).rejects.toThrow( 'dataPath: Missing value' )
        } )
    } )
} )
