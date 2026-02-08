class Validation {
    static validationProbe( { endpoint, timeout } ) {
        const struct = { status: false, messages: [] }

        if( endpoint === undefined ) {
            struct[ 'messages' ].push( 'endpoint: Missing value' )
        } else if( typeof endpoint !== 'string' ) {
            struct[ 'messages' ].push( 'endpoint: Must be a string' )
        } else if( endpoint.trim().length === 0 ) {
            struct[ 'messages' ].push( 'endpoint: Must not be empty' )
        }

        if( timeout === undefined ) {
            struct[ 'messages' ].push( 'timeout: Missing value' )
        } else if( typeof timeout !== 'number' ) {
            struct[ 'messages' ].push( 'timeout: Must be a number' )
        } else if( timeout <= 0 ) {
            struct[ 'messages' ].push( 'timeout: Must be greater than 0' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static error( { messages } ) {
        const messageString = messages.join( ', ' )

        throw new Error( messageString )
    }
}


export { Validation }
