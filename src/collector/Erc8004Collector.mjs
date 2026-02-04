import { Erc8004RegistryParser } from 'erc8004-registry-parser'

import { Validation } from '../task/Validation.mjs'


const BLOCK_BATCH_SIZE = 2000
const REGISTER_TOPIC = '0x0b17c3b72e3484dbb9f80a2d57d4fca4e29d3e082aa3e7e898ad9be11e4a7ab4'


class Erc8004Collector {
    static async collect( { alchemyUrl, fromBlock, contract } ) {
        const { status, messages } = Validation.validationCollectErc8004( { alchemyUrl, fromBlock, contract } )
        if( !status ) { Validation.error( { messages } ) }

        const discoveries = []
        let lastProcessedBlock = fromBlock

        try {
            const { latestBlock } = await Erc8004Collector.#getLatestBlock( { alchemyUrl } )

            if( latestBlock <= fromBlock ) {
                return {
                    status: true,
                    discoveries: [],
                    lastProcessedBlock: fromBlock,
                    error: null
                }
            }

            let currentFrom = fromBlock + 1

            while( currentFrom <= latestBlock ) {
                const currentTo = Math.min( currentFrom + BLOCK_BATCH_SIZE - 1, latestBlock )

                const { logs } = await Erc8004Collector.#fetchLogs( {
                    alchemyUrl,
                    contract,
                    fromBlock: currentFrom,
                    toBlock: currentTo
                } )

                const batchDiscoveries = Erc8004Collector.#processLogs( { logs } )
                discoveries.push( ...batchDiscoveries )

                lastProcessedBlock = currentTo
                currentFrom = currentTo + 1
            }
        } catch( error ) {
            return {
                status: false,
                discoveries,
                lastProcessedBlock,
                error: error.message
            }
        }

        return {
            status: true,
            discoveries,
            lastProcessedBlock,
            error: null
        }
    }


    static #processLogs( { logs } ) {
        const results = []

        logs
            .forEach( ( log ) => {
                try {
                    const eventLog = {
                        topics: log[ 'topics' ],
                        data: log[ 'data' ]
                    }

                    const { status: parseStatus, categories, entries } = Erc8004RegistryParser.start( { eventLog } )

                    if( entries === null || entries === undefined ) {
                        return
                    }

                    const { agentId, ownerAddress, name: agentName, uriAgentType, mcpEndpoint, a2aEndpoint } = entries
                    const { isSpecCompliant } = categories

                    if( mcpEndpoint !== null ) {
                        results.push( {
                            url: mcpEndpoint,
                            protocol: 'mcp',
                            sourceData: {
                                type: 'erc8004',
                                agentId,
                                ownerAddress,
                                agentName: agentName || null,
                                uriType: uriAgentType,
                                isSpecCompliant: isSpecCompliant || false,
                                discoveredAt: new Date().toISOString()
                            }
                        } )
                    }

                    if( a2aEndpoint !== null ) {
                        results.push( {
                            url: a2aEndpoint,
                            protocol: 'a2a',
                            sourceData: {
                                type: 'erc8004',
                                agentId,
                                ownerAddress,
                                agentName: agentName || null,
                                uriType: uriAgentType,
                                isSpecCompliant: isSpecCompliant || false,
                                discoveredAt: new Date().toISOString()
                            }
                        } )
                    }
                } catch( _e ) {
                    // Skip unparseable logs
                }
            } )

        return results
    }


    static async #getLatestBlock( { alchemyUrl } ) {
        const response = await fetch( alchemyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( {
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_blockNumber',
                params: []
            } )
        } )

        if( !response.ok ) {
            throw new Error( `Alchemy RPC returned ${response.status}` )
        }

        const data = await response.json()
        const latestBlock = parseInt( data[ 'result' ], 16 )

        return { latestBlock }
    }


    static async #fetchLogs( { alchemyUrl, contract, fromBlock, toBlock } ) {
        const response = await fetch( alchemyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( {
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_getLogs',
                params: [ {
                    address: contract,
                    fromBlock: `0x${fromBlock.toString( 16 )}`,
                    toBlock: `0x${toBlock.toString( 16 )}`,
                    topics: [ REGISTER_TOPIC ]
                } ]
            } )
        } )

        if( !response.ok ) {
            throw new Error( `Alchemy RPC returned ${response.status}` )
        }

        const data = await response.json()

        if( data[ 'error' ] ) {
            throw new Error( `RPC error: ${data[ 'error' ][ 'message' ]}` )
        }

        const logs = data[ 'result' ] || []

        return { logs }
    }
}


export { Erc8004Collector }
