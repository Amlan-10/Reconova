"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";

interface User {
    id: string;
    email: string;
    name: string | null;
    plan: string;
    trialSessionsUsed: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => void;
    updateTrialUsage: (count: number) => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem("reconova_token");
        const savedUser = localStorage.getItem("reconova_user");
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setIsLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        const res = await api.post("/auth/login", { email, password });
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem("reconova_token", newToken);
        localStorage.setItem("reconova_user", JSON.stringify(newUser));
    };

    const register = async (email: string, password: string, name?: string) => {
        const res = await api.post("/auth/register", { email, password, name });
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem("reconova_token", newToken);
        localStorage.setItem("reconova_user", JSON.stringify(newUser));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("reconova_token");
        localStorage.removeItem("reconova_user");
    };

    const updateTrialUsage = (count: number) => {
        if (user) {
            const updatedUser = { ...user, trialSessionsUsed: count };
            setUser(updatedUser);
            localStorage.setItem("reconova_user", JSON.stringify(updatedUser));
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, login, register, logout, updateTrialUsage, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}
