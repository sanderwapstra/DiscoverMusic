import to from 'await-to-js';
import mergeImages from 'merge-images';
import React, { useRef, useState } from 'react';
import ReactGA from 'react-ga';
import Modal from 'react-modal';
import { useSelector } from 'react-redux';
import SpotifyWebApi from 'spotify-web-api-js';
import { RootState } from '../../store/reducers';
import Button from '../Button/Button';
import StyledGeneratePlaylist from './GeneratePlaylist.styles';

Modal.setAppElement('#root');

const GeneratePlaylist: React.FC = () => {
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [playlistUri, setPlaylistUri] = useState('');
    const spotifyApi = useRef(new SpotifyWebApi());
    const { user } = useSelector((state: RootState) => state.app);
    const artists = useSelector((state: RootState) => state.artists);
    const trackAttributes = useSelector(
        (state: RootState) => state.trackAttributes
    );
    const { name } = useSelector((state: RootState) => state.playlist);

    const openModal = () => {
        setModalIsOpen(true);
    };

    const closeModal = () => {
        setModalIsOpen(false);
    };

    const getPlayListTitle = () => {
        return name ? `${name} :: Detune.it` : 'Playlist by Detune.it';
    };

    const getPlaylistDescription = () => {
        const artistNames = artists.map(artist => artist.name);

        return `Generated by Detune.it with these artists: ${artistNames.join(
            ', '
        )}`;
    };

    const createPlaylist = async () => {
        if (!user) return;

        ReactGA.event({
            category: 'Playlist',
            action: name
                ? 'User has chosen a custom name'
                : 'User did not chose a custom name',
            label: name || undefined,
        });

        const [err, playlist] = await to(
            spotifyApi.current.createPlaylist(user.id, {
                name: getPlayListTitle(),
                description: getPlaylistDescription(),
            })
        );

        if (err) {
            console.error(`❌ Creating playlist failed: ${err}`);
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
            console.error(`❌ Adding track to playlist failed: ${err}`);
        } else {
            openModal();

            const [err, response] = await to(
                spotifyApi.current.getPlaylistCoverImage(playlist.id)
            );

            if (err) {
                console.error(
                    `❌ Getting default playlist cover failed: ${err}`
                );
            }

            if (response && response.length > 0) {
                mergeImages(
                    [
                        response[0].url,
                        `${process.env.PUBLIC_URL}/artwork/mask.png`,
                        `${process.env.PUBLIC_URL}/artwork/logo.png`,
                    ],
                    { format: 'image/jpeg', crossOrigin: 'anonymous' }
                ).then(b64 => {
                    spotifyApi.current.uploadCustomPlaylistCoverImage(
                        playlist.id,
                        b64
                    );
                });
            }
        }
    };

    const getRecommendations = async () => {
        if (!artists.length) return;

        ReactGA.event({
            category: 'Playlist',
            action: `User has generated a playlist`,
        });

        const activeTrackAttributes: { [key: string]: number } = {};

        Object.keys(trackAttributes).forEach(attribute => {
            if (trackAttributes[attribute].active) {
                ReactGA.event({
                    category: 'Track attributes',
                    action: `User has tuned ${attribute}`,
                });

                activeTrackAttributes[attribute] =
                    trackAttributes[attribute].value;
            }
        });

        const [err, recommendations] = await to(
            spotifyApi.current.getRecommendations({
                seed_artists: artists.map(artist => artist.id),
                limit: 50,
                ...activeTrackAttributes,
            })
        );

        if (err) {
            console.error(`❌ Getting recommendations failed: ${err}`);
        }

        if (recommendations) {
            const playlist = await createPlaylist();

            if (playlist) {
                setPlaylistUri(playlist.uri);
                addTracksToPlaylist(playlist, recommendations);
            }
        }
    };

    return (
        <StyledGeneratePlaylist>
            <Button disabled={!artists.length} click={getRecommendations}>
                Generate playlist
            </Button>

            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                contentLabel="Open Spotify modal"
                style={{
                    overlay: {
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                    content: {
                        borderRadius: '16px',
                        background: '#000',
                        border: 0,
                        maxWidth: '620px',
                        padding: '32px',
                        margin: 'auto',
                        inset: 'auto 32px',
                        textAlign: 'center',
                    },
                }}
            >
                <h3>Your playlist is ready</h3>
                <Button href={playlistUri}>Open Spotify</Button>
            </Modal>
        </StyledGeneratePlaylist>
    );
};

export default GeneratePlaylist;
