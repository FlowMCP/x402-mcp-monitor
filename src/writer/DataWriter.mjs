import { writeFile, rename, readdir, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { Validation } from '../task/Validation.mjs'


const HISTORY_RETENTION_DAYS = 90


class DataWriter {
    static async writeEndpoints( { dataPath, endpointsData } ) {
        const { status, messages } = Validation.validationWriteEndpoints( { dataPath, endpointsData } )
        if( !status ) { Validation.error( { messages } ) }

        const filePath = join( dataPath, 'endpoints.json' )
        const tmpPath = `${filePath}.tmp`

        await mkdir( dataPath, { recursive: true } )
        await writeFile( tmpPath, JSON.stringify( endpointsData, null, 4 ), 'utf-8' )
        await rename( tmpPath, filePath )

        return { written: true }
    }


    static async writeHistory( { dataPath, historyEntry } ) {
        const { status, messages } = Validation.validationWriteHistory( { dataPath, historyEntry } )
        if( !status ) { Validation.error( { messages } ) }

        const historyDir = join( dataPath, 'history' )
        await mkdir( historyDir, { recursive: true } )

        const { date } = historyEntry
        const filePath = join( historyDir, `${date}.json` )
        const tmpPath = `${filePath}.tmp`

        await writeFile( tmpPath, JSON.stringify( historyEntry, null, 4 ), 'utf-8' )
        await rename( tmpPath, filePath )

        await DataWriter.#cleanOldHistory( { historyDir } )

        return { written: true }
    }


    static async #cleanOldHistory( { historyDir } ) {
        try {
            const files = await readdir( historyDir )
            const jsonFiles = files
                .filter( ( f ) => f.endsWith( '.json' ) )
                .sort()

            if( jsonFiles.length <= HISTORY_RETENTION_DAYS ) {
                return
            }

            const toDelete = jsonFiles.slice( 0, jsonFiles.length - HISTORY_RETENTION_DAYS )

            const deletePromises = toDelete
                .map( ( file ) => unlink( join( historyDir, file ) ) )

            await Promise.allSettled( deletePromises )
        } catch( _e ) {
            // History cleanup is best-effort
        }
    }
}


export { DataWriter }
