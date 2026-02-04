class Validation {
    static validationNormalizeUrl( { url } ) {
        const struct = { status: false, messages: [] }

        if( url === undefined ) {
            struct[ 'messages' ].push( 'url: Missing value' )
        } else if( typeof url !== 'string' ) {
            struct[ 'messages' ].push( 'url: Must be a string' )
        } else if( url.trim().length === 0 ) {
            struct[ 'messages' ].push( 'url: Must not be empty' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationGenerateId( { url } ) {
        const struct = { status: false, messages: [] }

        if( url === undefined ) {
            struct[ 'messages' ].push( 'url: Missing value' )
        } else if( typeof url !== 'string' ) {
            struct[ 'messages' ].push( 'url: Must be a string' )
        } else if( url.trim().length === 0 ) {
            struct[ 'messages' ].push( 'url: Must not be empty' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationMerge( { existingEndpoints, newDiscoveries } ) {
        const struct = { status: false, messages: [] }

        if( existingEndpoints === undefined ) {
            struct[ 'messages' ].push( 'existingEndpoints: Missing value' )
        } else if( !Array.isArray( existingEndpoints ) ) {
            struct[ 'messages' ].push( 'existingEndpoints: Must be an array' )
        }

        if( newDiscoveries === undefined ) {
            struct[ 'messages' ].push( 'newDiscoveries: Missing value' )
        } else if( !Array.isArray( newDiscoveries ) ) {
            struct[ 'messages' ].push( 'newDiscoveries: Must be an array' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationLoadState( { dataPath } ) {
        const struct = { status: false, messages: [] }

        if( dataPath === undefined ) {
            struct[ 'messages' ].push( 'dataPath: Missing value' )
        } else if( typeof dataPath !== 'string' ) {
            struct[ 'messages' ].push( 'dataPath: Must be a string' )
        } else if( dataPath.trim().length === 0 ) {
            struct[ 'messages' ].push( 'dataPath: Must not be empty' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationSaveState( { dataPath, state } ) {
        const struct = { status: false, messages: [] }

        if( dataPath === undefined ) {
            struct[ 'messages' ].push( 'dataPath: Missing value' )
        } else if( typeof dataPath !== 'string' ) {
            struct[ 'messages' ].push( 'dataPath: Must be a string' )
        } else if( dataPath.trim().length === 0 ) {
            struct[ 'messages' ].push( 'dataPath: Must not be empty' )
        }

        if( state === undefined ) {
            struct[ 'messages' ].push( 'state: Missing value' )
        } else if( typeof state !== 'object' || state === null || Array.isArray( state ) ) {
            struct[ 'messages' ].push( 'state: Must be an object' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationLoadEndpoints( { dataPath } ) {
        const struct = { status: false, messages: [] }

        if( dataPath === undefined ) {
            struct[ 'messages' ].push( 'dataPath: Missing value' )
        } else if( typeof dataPath !== 'string' ) {
            struct[ 'messages' ].push( 'dataPath: Must be a string' )
        } else if( dataPath.trim().length === 0 ) {
            struct[ 'messages' ].push( 'dataPath: Must not be empty' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationCollect( { registryUrl } ) {
        const struct = { status: false, messages: [] }

        if( registryUrl === undefined ) {
            struct[ 'messages' ].push( 'registryUrl: Missing value' )
        } else if( typeof registryUrl !== 'string' ) {
            struct[ 'messages' ].push( 'registryUrl: Must be a string' )
        } else if( registryUrl.trim().length === 0 ) {
            struct[ 'messages' ].push( 'registryUrl: Must not be empty' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationCollectErc8004( { alchemyUrl, fromBlock, contract } ) {
        const struct = { status: false, messages: [] }

        if( alchemyUrl === undefined ) {
            struct[ 'messages' ].push( 'alchemyUrl: Missing value' )
        } else if( typeof alchemyUrl !== 'string' ) {
            struct[ 'messages' ].push( 'alchemyUrl: Must be a string' )
        } else if( alchemyUrl.trim().length === 0 ) {
            struct[ 'messages' ].push( 'alchemyUrl: Must not be empty' )
        }

        if( fromBlock === undefined ) {
            struct[ 'messages' ].push( 'fromBlock: Missing value' )
        } else if( typeof fromBlock !== 'number' ) {
            struct[ 'messages' ].push( 'fromBlock: Must be a number' )
        }

        if( contract === undefined ) {
            struct[ 'messages' ].push( 'contract: Missing value' )
        } else if( typeof contract !== 'string' ) {
            struct[ 'messages' ].push( 'contract: Must be a string' )
        } else if( contract.trim().length === 0 ) {
            struct[ 'messages' ].push( 'contract: Must not be empty' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationCollectBazaar( { bazaarUrl } ) {
        const struct = { status: false, messages: [] }

        if( bazaarUrl === undefined ) {
            struct[ 'messages' ].push( 'bazaarUrl: Missing value' )
        } else if( typeof bazaarUrl !== 'string' ) {
            struct[ 'messages' ].push( 'bazaarUrl: Must be a string' )
        } else if( bazaarUrl.trim().length === 0 ) {
            struct[ 'messages' ].push( 'bazaarUrl: Must not be empty' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


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


    static validationProbeAll( { endpoints, maxConcurrency, timeout, probeMaxAgeDays } ) {
        const struct = { status: false, messages: [] }

        if( endpoints === undefined ) {
            struct[ 'messages' ].push( 'endpoints: Missing value' )
        } else if( !Array.isArray( endpoints ) ) {
            struct[ 'messages' ].push( 'endpoints: Must be an array' )
        }

        if( maxConcurrency === undefined ) {
            struct[ 'messages' ].push( 'maxConcurrency: Missing value' )
        } else if( typeof maxConcurrency !== 'number' ) {
            struct[ 'messages' ].push( 'maxConcurrency: Must be a number' )
        } else if( maxConcurrency <= 0 ) {
            struct[ 'messages' ].push( 'maxConcurrency: Must be greater than 0' )
        }

        if( timeout === undefined ) {
            struct[ 'messages' ].push( 'timeout: Missing value' )
        } else if( typeof timeout !== 'number' ) {
            struct[ 'messages' ].push( 'timeout: Must be a number' )
        } else if( timeout <= 0 ) {
            struct[ 'messages' ].push( 'timeout: Must be greater than 0' )
        }

        if( probeMaxAgeDays === undefined ) {
            struct[ 'messages' ].push( 'probeMaxAgeDays: Missing value' )
        } else if( typeof probeMaxAgeDays !== 'number' ) {
            struct[ 'messages' ].push( 'probeMaxAgeDays: Must be a number' )
        } else if( probeMaxAgeDays <= 0 ) {
            struct[ 'messages' ].push( 'probeMaxAgeDays: Must be greater than 0' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationWriteEndpoints( { dataPath, endpointsData } ) {
        const struct = { status: false, messages: [] }

        if( dataPath === undefined ) {
            struct[ 'messages' ].push( 'dataPath: Missing value' )
        } else if( typeof dataPath !== 'string' ) {
            struct[ 'messages' ].push( 'dataPath: Must be a string' )
        } else if( dataPath.trim().length === 0 ) {
            struct[ 'messages' ].push( 'dataPath: Must not be empty' )
        }

        if( endpointsData === undefined ) {
            struct[ 'messages' ].push( 'endpointsData: Missing value' )
        } else if( typeof endpointsData !== 'object' || endpointsData === null || Array.isArray( endpointsData ) ) {
            struct[ 'messages' ].push( 'endpointsData: Must be an object' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationWriteHistory( { dataPath, historyEntry } ) {
        const struct = { status: false, messages: [] }

        if( dataPath === undefined ) {
            struct[ 'messages' ].push( 'dataPath: Missing value' )
        } else if( typeof dataPath !== 'string' ) {
            struct[ 'messages' ].push( 'dataPath: Must be a string' )
        } else if( dataPath.trim().length === 0 ) {
            struct[ 'messages' ].push( 'dataPath: Must not be empty' )
        }

        if( historyEntry === undefined ) {
            struct[ 'messages' ].push( 'historyEntry: Missing value' )
        } else if( typeof historyEntry !== 'object' || historyEntry === null || Array.isArray( historyEntry ) ) {
            struct[ 'messages' ].push( 'historyEntry: Must be an object' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationBuildDashboardData( { endpointsData } ) {
        const struct = { status: false, messages: [] }

        if( endpointsData === undefined ) {
            struct[ 'messages' ].push( 'endpointsData: Missing value' )
        } else if( typeof endpointsData !== 'object' || endpointsData === null || Array.isArray( endpointsData ) ) {
            struct[ 'messages' ].push( 'endpointsData: Must be an object' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }


    static validationCollectAll( { dataPath, alchemyUrl, probeMaxConcurrency, probeTimeoutMs, probeMaxAgeDays } ) {
        const struct = { status: false, messages: [] }

        if( dataPath === undefined ) {
            struct[ 'messages' ].push( 'dataPath: Missing value' )
        } else if( typeof dataPath !== 'string' ) {
            struct[ 'messages' ].push( 'dataPath: Must be a string' )
        } else if( dataPath.trim().length === 0 ) {
            struct[ 'messages' ].push( 'dataPath: Must not be empty' )
        }

        if( alchemyUrl === undefined ) {
            struct[ 'messages' ].push( 'alchemyUrl: Missing value' )
        } else if( typeof alchemyUrl !== 'string' ) {
            struct[ 'messages' ].push( 'alchemyUrl: Must be a string' )
        } else if( alchemyUrl.trim().length === 0 ) {
            struct[ 'messages' ].push( 'alchemyUrl: Must not be empty' )
        }

        if( probeMaxConcurrency === undefined ) {
            struct[ 'messages' ].push( 'probeMaxConcurrency: Missing value' )
        } else if( typeof probeMaxConcurrency !== 'number' ) {
            struct[ 'messages' ].push( 'probeMaxConcurrency: Must be a number' )
        } else if( probeMaxConcurrency <= 0 ) {
            struct[ 'messages' ].push( 'probeMaxConcurrency: Must be greater than 0' )
        }

        if( probeTimeoutMs === undefined ) {
            struct[ 'messages' ].push( 'probeTimeoutMs: Missing value' )
        } else if( typeof probeTimeoutMs !== 'number' ) {
            struct[ 'messages' ].push( 'probeTimeoutMs: Must be a number' )
        } else if( probeTimeoutMs <= 0 ) {
            struct[ 'messages' ].push( 'probeTimeoutMs: Must be greater than 0' )
        }

        if( probeMaxAgeDays === undefined ) {
            struct[ 'messages' ].push( 'probeMaxAgeDays: Missing value' )
        } else if( typeof probeMaxAgeDays !== 'number' ) {
            struct[ 'messages' ].push( 'probeMaxAgeDays: Must be a number' )
        } else if( probeMaxAgeDays <= 0 ) {
            struct[ 'messages' ].push( 'probeMaxAgeDays: Must be greater than 0' )
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
