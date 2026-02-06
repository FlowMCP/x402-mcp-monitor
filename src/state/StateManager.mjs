import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

import { Validation } from '../task/Validation.mjs'


const DEFAULT_STATE = {
    version: 1,
    updatedAt: null,
    cursors: {
        'erc8004': {
            lastProcessedBlock: 24339925,
            lastFetchedAt: null,
            genesisBlock: 24339925,
            contract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
        },
        'bazaar': {
            lastOffset: 0,
            lastFetchedAt: null,
            totalFetched: 0
        }
    },
    probeMaxAgeDays: 7
}


const DEFAULT_ENDPOINTS = {
    version: 1,
    updatedAt: null,
    stats: {
        total: 0,
        reachable: 0,
        withX402: 0,
        withTools: 0,
        bySource: { 'erc8004': 0, 'bazaar': 0, 'manual': 0 },
        byProtocol: { 'mcp': 0, 'a2a': 0 }
    },
    endpoints: []
}


class StateManager {
    static async loadState( { dataPath } ) {
        const { status, messages } = Validation.validationLoadState( { dataPath } )
        if( !status ) { Validation.error( { messages } ) }

        const filePath = join( dataPath, 'state.json' )

        try {
            const raw = await readFile( filePath, 'utf-8' )
            const state = JSON.parse( raw )

            return { state }
        } catch( _e ) {
            const state = { ...DEFAULT_STATE }

            return { state }
        }
    }


    static async saveState( { dataPath, state } ) {
        const { status, messages } = Validation.validationSaveState( { dataPath, state } )
        if( !status ) { Validation.error( { messages } ) }

        const filePath = join( dataPath, 'state.json' )
        const tmpPath = `${filePath}.tmp`
        const updatedState = { ...state, updatedAt: new Date().toISOString() }

        await mkdir( dirname( filePath ), { recursive: true } )
        await writeFile( tmpPath, JSON.stringify( updatedState, null, 4 ), 'utf-8' )
        await rename( tmpPath, filePath )

        return { state: updatedState }
    }


    static async loadEndpoints( { dataPath } ) {
        const { status, messages } = Validation.validationLoadEndpoints( { dataPath } )
        if( !status ) { Validation.error( { messages } ) }

        const filePath = join( dataPath, 'endpoints.json' )

        try {
            const raw = await readFile( filePath, 'utf-8' )
            const endpointsData = JSON.parse( raw )

            return { endpointsData }
        } catch( _e ) {
            const endpointsData = { ...DEFAULT_ENDPOINTS, endpoints: [] }

            return { endpointsData }
        }
    }
}


export { StateManager }
