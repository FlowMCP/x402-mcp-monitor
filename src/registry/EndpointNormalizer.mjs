import { createHash } from 'node:crypto'

import { Validation } from '../task/Validation.mjs'


class EndpointNormalizer {
    static normalizeUrl( { url } ) {
        const { status, messages } = Validation.validationNormalizeUrl( { url } )
        if( !status ) { Validation.error( { messages } ) }

        const trimmed = url.trim()
        let parsed

        try {
            parsed = new URL( trimmed )
        } catch( _e ) {
            const normalized = trimmed.toLowerCase().replace( /\/+$/, '' )

            return { normalizedUrl: normalized }
        }

        parsed.hostname = parsed.hostname.toLowerCase()
        parsed.protocol = parsed.protocol.toLowerCase()

        let pathname = parsed.pathname.replace( /\/+$/, '' )
        if( pathname === '' ) {
            pathname = ''
        }

        const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${pathname}${parsed.search}`

        return { normalizedUrl: normalized }
    }


    static generateId( { url } ) {
        const { status, messages } = Validation.validationGenerateId( { url } )
        if( !status ) { Validation.error( { messages } ) }

        const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url } )
        const hash = createHash( 'sha256' ).update( normalizedUrl ).digest( 'hex' ).slice( 0, 8 )
        const id = `ep_${hash}`

        return { id }
    }
}


export { EndpointNormalizer }
