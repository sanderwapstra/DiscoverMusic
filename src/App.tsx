import to from 'await-to-js';
import queryString from 'query-string';
import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import SpotifyWebApi from 'spotify-web-api-js';
import { setToken, setUser } from './store/appSlice';
import { addArtist, removeArtist } from './store/artistsSlice';
import { RootState } from './store/reducers';

function App() {
    const dispatch = useDispatch();
    const spotifyApi = useRef(new SpotifyWebApi());
    const artists = useSelector((state: RootState) => state.artists);
    const { token, user } = useSelector((state: RootState) => state.app);
    const { register, handleSubmit, errors } = useForm();

    const onSubmit = async (data: any) => {
        const [err, results] = await to(
            spotifyApi.current.search(data.artist, ['artist'])
        );

        if (err) {
            console.error(`Something went wrong: ${err}`);
        }

        if (results?.artists?.items) {
            dispatch(addArtist(results.artists.items[0]));
        }
    };

    const loginWithSpotify = () => {
        const scopes = 'playlist-modify-public';
        const redirectUrl =
            process.env.NODE_ENV === 'development'
                ? 'https://localhost:3000/'
                : 'https://discovermusic.netlify.app/';

        window.location.replace(
            `https://accounts.spotify.com/authorize?client_id=453ef47ef0c24a63a38a91b855d9c9b3&redirect_uri=${encodeURIComponent(
                redirectUrl
            )}&scope=${encodeURIComponent(scopes)}&response_type=token`
        );
    };

    const createPlaylist = async () => {
        if (!user) return;

        const [err, playlist] = await to(
            spotifyApi.current.createPlaylist(user.id, {
                name: 'DiscoverMusic.now demo',
                description: 'Generated by DiscoverMusic.now.',
            })
        );

        if (err) {
            console.error(`Something went wrong: ${err}`);
        }

        return playlist;
    };

    const addTracksToPlaylist = async (
        playlist: SpotifyApi.CreatePlaylistResponse,
        recommendations: SpotifyApi.RecommendationsFromSeedsResponse
    ) => {
        const [err] = await to(
            spotifyApi.current.addTracksToPlaylist(
                playlist.id,
                recommendations.tracks.map(track => track.uri)
            )
        );

        if (err) {
            console.error(`Something went wrong: ${err}`);
        } else {
            alert('Check your Spotify, a new playlist is ready!');
        }
    };

    const getRecommendations = async () => {
        if (!artists.length) return;

        const [err, recommendations] = await to(
            spotifyApi.current.getRecommendations({
                seed_artists: artists.map(artist => artist.id),
                limit: 50,
            })
        );

        if (err) {
            console.error(`Something went wrong: ${err}`);
        }

        if (recommendations) {
            const playlist = await createPlaylist();

            if (playlist) {
                addTracksToPlaylist(playlist, recommendations);
            }
        }
    };

    // Save token after first login
    useEffect(() => {
        if (!token && window.location.hash) {
            const parsedHash = queryString.parse(window.location.hash);

            dispatch(setToken(parsedHash.access_token));

            if (parsedHash && parsedHash.access_token) {
                spotifyApi.current.setAccessToken(
                    parsedHash.access_token as string
                );
            }
        }
    }, [dispatch, token]);

    // Set access token after getting token
    // Save user info to Redux
    useEffect(() => {
        const setAccessToken = () => {
            spotifyApi.current.setAccessToken(token);
        };

        const getUser = async () => {
            const [err, user] = await to(spotifyApi.current.getMe());

            if (err) {
                // Clear local data
                window.localStorage.removeItem('persist:root');

                console.error(`Something went wrong: ${err}`);
            }

            if (user) {
                dispatch(setUser(user));
            }
        };

        if (token) {
            setAccessToken();
            getUser();
        }
    }, [dispatch, token]);

    return (
        <div className="App">
            {token && user ? (
                <>
                    <h1>Hi, {user.display_name}!</h1>
                    <h2>Add up to 5 artists to get a personalised playlist.</h2>

                    {artists.length < 5 && (
                        <form
                            onSubmit={handleSubmit(onSubmit)}
                            style={{ marginBottom: 20 }}
                        >
                            <input
                                type="text"
                                placeholder="Artist"
                                name="artist"
                                ref={register({
                                    required: true,
                                    maxLength: 80,
                                })}
                            />
                            {errors.artist && 'Artist is required'}

                            <button type="submit">Add artist</button>
                        </form>
                    )}

                    {artists.length > 0 && (
                        <>
                            <h3>Selected artists</h3>
                            {artists.map((artist, index) => (
                                <div key={artist.id}>
                                    {index + 1}. {artist.name}
                                    <button
                                        onClick={() =>
                                            dispatch(removeArtist(artist.id))
                                        }
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </>
                    )}

                    <h2>Finetuning. What is important to you?</h2>
                    <div style={{ marginBottom: 10 }}>
                        <label htmlFor="acousticness">Acousticness</label>
                        <input
                            type="range"
                            id="acousticness"
                            name="acousticness"
                            min="0.0"
                            max="1.0"
                            defaultValue="0.0"
                            step="0.1"
                        />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                        <label htmlFor="danceability">Danceability</label>
                        <input
                            type="range"
                            id="danceability"
                            name="danceability"
                            min="0.0"
                            max="1.0"
                            defaultValue="0.0"
                            step="0.1"
                        />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                        <label htmlFor="energy">Energy</label>
                        <input
                            type="range"
                            id="energy"
                            name="energy"
                            min="0.0"
                            max="1.0"
                            defaultValue="0.0"
                            step="0.1"
                        />
                    </div>
                    {/*
                    target_instrumentalness?: number;
                    target_key?: number;
                    target_liveness?: number;
                    target_loudness?: number;
                    target_mode?: number;
                    target_popularity?: number;
                    target_speechiness?: number;
                    target_tempo?: number;
                    target_time_signature?: number;
                    target_valence?: number;
                    */}

                    <h2>Generate playlist</h2>
                    <button onClick={getRecommendations}>Generate</button>
                </>
            ) : (
                <button onClick={loginWithSpotify}>Login with Spotify</button>
            )}
        </div>
    );
}

export default App;
