import { Validation } from '../task/Validation.mjs'


const BAZAAR_BASE = 'https://api.cdp.coinbase.com/platform/v2/x402/discovery'
const PAGE_LIMIT = 100
const MAX_RETRIES = 3
const RETRY_DELAYS = [ 5000, 10000, 20000 ]


class BazaarCollector {
    static #sleep( ms ) {
        return new Promise( ( resolve ) => setTimeout( resolve, ms ) )
    }


    static async #fetchWithRetry( { url, retryCount = 0 } ) {
        const response = await fetch( url, {
            headers: { 'Accept': 'application/json' }
        } )

        if( response.status === 429 && retryCount < MAX_RETRIES ) {
            const delay = RETRY_DELAYS[ retryCount ]
            await BazaarCollector.#sleep( delay )

            return BazaarCollector.#fetchWithRetry( { url, retryCount: retryCount + 1 } )
        }

        return response
    }


    static async collect( { bazaarUrl = BAZAAR_BASE } ) {
        const { status, messages } = Validation.validationCollectBazaar( { bazaarUrl } )
        if( !status ) { Validation.error( { messages } ) }

        const discoveries = []
        let offset = 0
        let totalFetched = 0

        try {
            let hasMore = true

            while( hasMore ) {
                const params = new URLSearchParams( {
                    limit: String( PAGE_LIMIT ),
                    offset: String( offset )
                } )

                const url = `${bazaarUrl}/resources?${params.toString()}`
                const response = await BazaarCollector.#fetchWithRetry( { url } )

                if( !response.ok ) {
                    throw new Error( `Bazaar API returned ${response.status}` )
                }

                const data = await response.json()
                const { items, pagination } = data

                if( items === null || items === undefined || items.length === 0 ) {
                    hasMore = false

                    break
                }

                items
                    .forEach( ( item ) => {
                        const { resource: resourceUrl, accepts, type, x402Version, lastUpdated } = item

                        if( resourceUrl === undefined || resourceUrl === null || resourceUrl.trim().length === 0 ) {
                            return
                        }

                        const paymentOptions = ( accepts || [] )
                            .map( ( accept ) => {
                                const option = {
                                    network: accept[ 'network' ] || null,
                                    scheme: accept[ 'scheme' ] || null,
                                    asset: accept[ 'asset' ] || null,
                                    amount: accept[ 'maxAmountRequired' ] || null,
                                    payTo: accept[ 'payTo' ] || null
                                }

                                return option
                            } )

                        discoveries.push( {
                            url: resourceUrl,
                            protocol: 'mcp',
                            sourceData: {
                                type: 'bazaar',
                                resourceName: resourceUrl,
                                resourceType: type || null,
                                x402Version: x402Version || null,
                                lastUpdated: lastUpdated || null,
                                paymentOptions,
                                discoveredAt: new Date().toISOString()
                            }
                        } )

                        totalFetched += 1
                    } )

                const total = pagination ? pagination[ 'total' ] : null

                if( total !== null && offset + PAGE_LIMIT >= total ) {
                    hasMore = false
                } else if( items.length < PAGE_LIMIT ) {
                    hasMore = false
                } else {
                    offset += PAGE_LIMIT
                }
            }
        } catch( error ) {
            return {
                status: false,
                discoveries,
                totalFetched,
                error: error.message
            }
        }

        return {
            status: true,
            discoveries,
            totalFetched,
            error: null
        }
    }
}


export { BazaarCollector }
