import Vue from 'vue'
import router from '../../router'
import { SET_USER_ADMIN, SET_USER_AUTHENTICATED, SET_USER_STATUS } from './user'
import { SET_ROOM_USERS } from './room'

export const SET_SOCKET = 'SET_SOCKET'
export const SET_PING_INTERVAL = 'SET_PING_INTERVAL'
export const SET_PING_TIMEOUT = 'SET_PING_TIMEOUT'

function closeSocket() {
    console.log("Closing socket")
    Vue.prototype.$socket.close()
    delete Vue.prototype.$socket
}

const state = () => ({
    socket: {
        isConnected: false,
        reconnectError: false,
    },
    ping: {
        interval: null,
        timeout: null,
    }
})

const getters = {
    connectedToServer(state) {
        return state.socket.isConnected
    }
}

const mutations = {
    [SET_SOCKET](state, { isConnected, reconnectError }) {
        state.socket.isConnected = isConnected
        state.socket.reconnectError = reconnectError
    },
    [SET_PING_INTERVAL](state, interval) {
        state.ping.interval = interval
    },
    [SET_PING_TIMEOUT](state, timeout) {
        state.ping.timeout = timeout
    }
}

const actions = {
    ping({ state, commit }) {
        if (state.ping.timeout != null) {
            clearTimeout(state.ping.timeout)
        }
        commit(SET_PING_TIMEOUT, setTimeout(function () {
            Vue.prototype.$socket.reconnect()
        }, 5000))
        Vue.prototype.$socket.sendObj({ type: 'ping' })
    },
    SOCKET_ONOPEN({ state, commit, dispatch }) {
        console.debug(Vue.prototype.$socket)
        commit(SET_SOCKET, { isConnected: true, reconnectError: false })
        window.addEventListener('beforeunload', closeSocket)
        if (state.ping.interval != null) {
            clearInterval(state.ping.interval)
        }
        commit(SET_PING_INTERVAL, setInterval(() => dispatch('ping'), 30000))
    },
    SOCKET_ONCLOSE({ state, commit }) {
        if (state.socket.isConnected) {
            commit(SET_SOCKET, { isConnected: false, reconnectError: false })
            clearInterval(state.ping.interval)
            commit(SET_PING_INTERVAL, null)
            window.removeEventListener('beforeunload', closeSocket)
        }
    },
    SOCKET_ONERROR({ state, commit }, event) {
        console.error(state, event)
        if (state.socket.isConnected) {
            commit(SET_SOCKET, { isConnected: false, reconnectError: false })
            clearInterval(state.ping.interval)
            commit(SET_PING_INTERVAL, null)
            window.removeEventListener('beforeunload', closeSocket)
        }
    },
    // default handler called for all methods
    SOCKET_ONMESSAGE({ state, commit, dispatch, rootState }, message) {
        console.debug(message)
        switch (message.type) {
            case "pong":
                clearTimeout(state.ping.timeout)
                commit(SET_PING_TIMEOUT, null)
                break
            case "registration":
                if (message.result === "success") {
                    commit('user/' + SET_USER_AUTHENTICATED, true)
                    router.push('/')
                }
                break
            case "room_update":
                commit('room/' + SET_ROOM_USERS, message.user_list)
                message.user_list.forEach((user) => {
                    if (user.user_name === rootState.user.userName) {
                        commit('user/' + SET_USER_STATUS, user.status)
                        if (user.is_admin) {
                            commit('user/' + SET_USER_ADMIN, true)
                        }
                    }
                })
                switch (message.room_state) {
                    case 1:
                        if (router.currentRoute.name !== 'game') {
                            router.push({ name: 'game' })
                        }
                        break
                    case 2:
                        if (router.currentRoute.name !== 'result') {
                            router.push({ name: 'result' })
                        }
                        break
                }
                break
            case "round_update":
                dispatch('game/roundUpdate', { current: message.current_stage, last: message.last_stage, text: message.text })
                break
            case "show_story":
                dispatch('result/displayStory', { stories: message.stories, userName: message.user_name })
                break
            case "close_room":
                dispatch('user/reset')
                dispatch('room/reset')
                dispatch('result/reset')
                router.push('/login')
                break
            default:
        }
    },
    // mutations for reconnect methods
    SOCKET_RECONNECT({ state }, count) {
        console.info(state, count)
    },
    SOCKET_RECONNECT_ERROR({ commit }) {
        commit(SET_SOCKET, { isConnected: false, reconnectError: true })
    }
}

// Cannot be namespaced due to vue-native-websocket plugin
export default {
    state,
    getters,
    actions,
    mutations
}
