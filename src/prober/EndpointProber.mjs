import { McpProbe } from './McpProbe.mjs'
import { A2aProbe } from './A2aProbe.mjs'
import { Validation } from '../task/Validation.mjs'


class EndpointProber {
    static async probeAll( { endpoints, maxConcurrency = 5, timeout = 15000, probeMaxAgeDays = 7 } ) {
        const { status, messages } = Validation.validationProbeAll( { endpoints, maxConcurrency, timeout, probeMaxAgeDays } )
        if( !status ) { Validation.error( { messages } ) }

        const now = Date.now()
        const maxAgeMs = probeMaxAgeDays * 24 * 60 * 60 * 1000
        let probedCount = 0

        const needsProbing = endpoints
            .filter( ( endpoint ) => {
                const { probe } = endpoint

                if( probe === null ) {
                    return true
                }

                const { timestamp } = probe
                const probeAge = now - new Date( timestamp ).getTime()

                if( probeAge >= maxAgeMs ) {
                    return true
                }

                return false
            } )

        const semaphore = { current: 0, queue: [] }

        const acquire = async () => {
            if( semaphore[ 'current' ] < maxConcurrency ) {
                semaphore[ 'current' ] += 1

                return
            }

            const promise = new Promise( ( resolve ) => {
                semaphore[ 'queue' ].push( resolve )
            } )

            await promise
        }

        const release = () => {
            semaphore[ 'current' ] -= 1

            if( semaphore[ 'queue' ].length > 0 ) {
                semaphore[ 'current' ] += 1
                const next = semaphore[ 'queue' ].shift()
                next()
            }
        }

        const probeOne = async ( { endpoint: ep } ) => {
            await acquire()

            try {
                const { url, protocol } = ep
                let probeResult

                if( protocol === 'a2a' ) {
                    const result = await A2aProbe.probe( { endpoint: url, timeout } )
                    probeResult = result[ 'probeResult' ]
                } else {
                    const result = await McpProbe.probe( { endpoint: url, timeout } )
                    probeResult = result[ 'probeResult' ]
                }

                ep[ 'probe' ] = probeResult
                probedCount += 1
            } catch( _e ) {
                ep[ 'probe' ] = {
                    timestamp: new Date().toISOString(),
                    status: false,
                    categories: { isReachable: false },
                    summary: {},
                    messages: [ 'Probe failed unexpectedly' ]
                }
                probedCount += 1
            } finally {
                release()
            }
        }

        const probePromises = needsProbing
            .map( ( ep ) => probeOne( { endpoint: ep } ) )

        await Promise.allSettled( probePromises )

        return { endpoints, probedCount }
    }
}


export { EndpointProber }
