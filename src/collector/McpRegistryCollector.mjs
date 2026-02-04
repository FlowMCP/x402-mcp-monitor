import { Validation } from '../task/Validation.mjs'


const REGISTRY_BASE = 'https://registry.modelcontextprotocol.io'
const PAGE_LIMIT = 100
const REMOTE_TYPES_WITH_URL = [ 'streamable-http', 'sse' ]


class McpRegistryCollector {
    static async collect( { registryUrl = REGISTRY_BASE } ) {
        const { status, messages } = Validation.validationCollect( { registryUrl } )
        if( !status ) { Validation.error( { messages } ) }

        const discoveries = []
        let cursor = null
        let totalFetched = 0

        try {
            let hasMore = true

            const fetchPages = async () => {
                const results = []

                const fetchPage = async ( { currentCursor } ) => {
                    const params = new URLSearchParams( { limit: String( PAGE_LIMIT ) } )
                    if( currentCursor !== null ) {
                        params.set( 'cursor', currentCursor )
                    }

                    const url = `${registryUrl}/v0.1/servers?${params.toString()}`
                    const response = await fetch( url, {
                        headers: { 'Accept': 'application/json' }
                    } )

                    if( !response.ok ) {
                        throw new Error( `Registry API returned ${response.status}` )
                    }

                    const data = await response.json()

                    return { data }
                }

                while( hasMore ) {
                    const { data } = await fetchPage( { currentCursor: cursor } )
                    const { metadata, servers } = data

                    if( servers === null || servers === undefined || servers.length === 0 ) {
                        hasMore = false

                        break
                    }

                    servers
                        .forEach( ( entry ) => {
                            const { _meta, server } = entry
                            const { name: serverName, version: serverVersion, description, remotes } = server
                            const registryMeta = _meta[ 'io.modelcontextprotocol.registry/official' ] || {}
                            const { status: serverStatus } = registryMeta

                            if( remotes === null || remotes === undefined ) {
                                return
                            }

                            remotes
                                .forEach( ( remote ) => {
                                    const { type, url: remoteUrl } = remote

                                    if( !REMOTE_TYPES_WITH_URL.includes( type ) ) {
                                        return
                                    }

                                    if( remoteUrl === undefined || remoteUrl === null || remoteUrl.trim().length === 0 ) {
                                        return
                                    }

                                    if( remoteUrl.includes( '{{' ) ) {
                                        return
                                    }

                                    results.push( {
                                        url: remoteUrl,
                                        protocol: 'mcp',
                                        sourceData: {
                                            type: 'mcp-registry',
                                            serverName,
                                            serverVersion,
                                            description: description || null,
                                            status: serverStatus || 'active',
                                            transportType: type,
                                            discoveredAt: new Date().toISOString()
                                        }
                                    } )
                                } )

                            totalFetched += 1
                        } )

                    const { nextCursor } = metadata

                    if( nextCursor === null || nextCursor === undefined ) {
                        hasMore = false
                    } else {
                        cursor = nextCursor
                    }
                }

                return results
            }

            const results = await fetchPages()
            discoveries.push( ...results )
        } catch( error ) {
            return {
                status: false,
                discoveries: [],
                cursor: null,
                totalFetched,
                error: error.message
            }
        }

        return {
            status: true,
            discoveries,
            cursor,
            totalFetched,
            error: null
        }
    }
}


export { McpRegistryCollector }
