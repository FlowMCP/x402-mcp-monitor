import { readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { DataWriter } from '../../src/writer/DataWriter.mjs'


const TEST_DATA_PATH = join( new URL( '.', import.meta.url ).pathname, '..', 'tmp-writer-test' )


describe( 'DataWriter', () => {
    beforeEach( async () => {
        await mkdir( TEST_DATA_PATH, { recursive: true } )
    } )


    afterEach( async () => {
        await rm( TEST_DATA_PATH, { recursive: true, force: true } )
    } )


    describe( 'writeEndpoints', () => {
        test( 'writes endpoints to file', async () => {
            const endpointsData = {
                version: 1,
                updatedAt: '2026-02-04T12:00:00.000Z',
                stats: { total: 1 },
                endpoints: [ { id: 'ep_abc', url: 'https://test.com' } ]
            }

            const { written } = await DataWriter.writeEndpoints( {
                dataPath: TEST_DATA_PATH,
                endpointsData
            } )

            expect( written ).toBe( true )

            const raw = await readFile( join( TEST_DATA_PATH, 'endpoints.json' ), 'utf-8' )
            const parsed = JSON.parse( raw )

            expect( parsed[ 'stats' ][ 'total' ] ).toBe( 1 )
            expect( parsed[ 'endpoints' ] ).toHaveLength( 1 )
        } )


        test( 'throws on missing dataPath', async () => {
            await expect(
                DataWriter.writeEndpoints( { endpointsData: {} } )
            ).rejects.toThrow( 'dataPath: Missing value' )
        } )


        test( 'throws on missing endpointsData', async () => {
            await expect(
                DataWriter.writeEndpoints( { dataPath: TEST_DATA_PATH } )
            ).rejects.toThrow( 'endpointsData: Missing value' )
        } )
    } )


    describe( 'writeHistory', () => {
        test( 'writes history entry to file', async () => {
            const historyEntry = {
                date: '2026-02-04',
                total: 100,
                reachable: 50,
                withX402: 5,
                bySource: { 'mcp-registry': 60, 'erc8004': 80, 'bazaar': 10 },
                newEndpoints: 3,
                probedThisRun: 20
            }

            const { written } = await DataWriter.writeHistory( {
                dataPath: TEST_DATA_PATH,
                historyEntry
            } )

            expect( written ).toBe( true )

            const raw = await readFile( join( TEST_DATA_PATH, 'history', '2026-02-04.json' ), 'utf-8' )
            const parsed = JSON.parse( raw )

            expect( parsed[ 'total' ] ).toBe( 100 )
            expect( parsed[ 'date' ] ).toBe( '2026-02-04' )
        } )


        test( 'cleans old history beyond 90 days', async () => {
            const historyDir = join( TEST_DATA_PATH, 'history' )
            await mkdir( historyDir, { recursive: true } )

            const createHistoryFiles = Array.from( { length: 95 } )
                .map( ( _, i ) => {
                    const day = String( i + 1 ).padStart( 2, '0' )
                    const month = i < 31 ? '01' : i < 59 ? '02' : i < 90 ? '03' : '04'
                    const dayOfMonth = i < 31 ? day : i < 59 ? String( i - 30 ).padStart( 2, '0' ) : i < 90 ? String( i - 58 ).padStart( 2, '0' ) : String( i - 89 ).padStart( 2, '0' )
                    const filename = `2026-${month}-${dayOfMonth}.json`

                    return writeFile( join( historyDir, filename ), '{}', 'utf-8' )
                } )

            await Promise.all( createHistoryFiles )

            const newEntry = {
                date: '2026-04-06',
                total: 100,
                reachable: 50,
                withX402: 5,
                bySource: {},
                newEndpoints: 0,
                probedThisRun: 0
            }

            await DataWriter.writeHistory( {
                dataPath: TEST_DATA_PATH,
                historyEntry: newEntry
            } )

            const { readdir } = await import( 'node:fs/promises' )
            const files = await readdir( historyDir )
            const jsonFiles = files.filter( ( f ) => f.endsWith( '.json' ) )

            expect( jsonFiles.length ).toBeLessThanOrEqual( 90 )
        } )


        test( 'throws on missing dataPath', async () => {
            await expect(
                DataWriter.writeHistory( { historyEntry: { date: '2026-02-04' } } )
            ).rejects.toThrow( 'dataPath: Missing value' )
        } )
    } )
} )
