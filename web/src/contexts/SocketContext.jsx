import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { baseURL } from '../api/client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    // baseURL usually includes /api, we need just the domain usually, or let socket.io handle it
    // If baseURL is http://localhost:5000, socket.io works fine.
    const socketUrl = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    
    const newSocket = io(socketUrl, {
      transports: ['websocket'], // Force websocket to avoid polling issues sometimes
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
