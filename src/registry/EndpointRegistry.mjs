import { EndpointNormalizer } from './EndpointNormalizer.mjs'
import { Validation } from '../task/Validation.mjs'


class EndpointRegistry {
    static merge( { existingEndpoints, newDiscoveries } ) {
        const { status, messages } = Validation.validationMerge( { existingEndpoints, newDiscoveries } )
        if( !status ) { Validation.error( { messages } ) }

        const endpointMap = new Map()

        existingEndpoints
            .forEach( ( endpoint ) => {
                endpointMap.set( endpoint[ 'id' ], { ...endpoint } )
            } )

        newDiscoveries
            .forEach( ( discovery ) => {
                const { url, protocol, sourceData } = discovery
                const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url } )
                const { id } = EndpointNormalizer.generateId( { url: normalizedUrl } )

                if( endpointMap.has( id ) ) {
                    const existing = endpointMap.get( id )
                    const { sources: updatedSources } = EndpointRegistry.#mergeSource( {
                        existingSources: existing[ 'sources' ],
                        newSource: sourceData
                    } )
                    existing[ 'sources' ] = updatedSources
                } else {
                    const newEndpoint = {
                        id,
                        url: normalizedUrl,
                        protocol,
                        sources: [ sourceData ],
                        probe: null
                    }
                    endpointMap.set( id, newEndpoint )
                }
            } )

        const endpoints = Array.from( endpointMap.values() )

        return { endpoints }
    }


    static computeStats( { endpoints } ) {
        const stats = {
            total: endpoints.length,
            reachable: 0,
            withX402: 0,
            withTools: 0,
            bySource: {
                'erc8004': 0,
                'bazaar': 0,
                'manual': 0
            },
            byProtocol: {
                'mcp': 0,
                'a2a': 0
            }
        }

        endpoints
            .forEach( ( endpoint ) => {
                const { protocol, sources, probe } = endpoint

                if( stats[ 'byProtocol' ][ protocol ] !== undefined ) {
                    stats[ 'byProtocol' ][ protocol ] += 1
                }

                sources
                    .forEach( ( source ) => {
                        const { type } = source
                        if( stats[ 'bySource' ][ type ] !== undefined ) {
                            stats[ 'bySource' ][ type ] += 1
                        }
                    } )

                if( probe !== null && probe[ 'status' ] === true ) {
                    const { categories } = probe

                    if( categories[ 'isReachable' ] === true ) {
                        stats[ 'reachable' ] += 1
                    }

                    if( categories[ 'supportsX402' ] === true ) {
                        stats[ 'withX402' ] += 1
                    }

                    if( categories[ 'hasTools' ] === true || categories[ 'hasSkills' ] === true ) {
                        stats[ 'withTools' ] += 1
                    }
                }
            } )

        return { stats }
    }


    static #mergeSource( { existingSources, newSource } ) {
        const { type } = newSource
        const existingIndex = existingSources.findIndex( ( s ) => s[ 'type' ] === type )

        if( existingIndex >= 0 ) {
            const updatedSources = [ ...existingSources ]
            updatedSources[ existingIndex ] = newSource

            return { sources: updatedSources }
        }

        const sources = [ ...existingSources, newSource ]

        return { sources }
    }
}


export { EndpointRegistry }
