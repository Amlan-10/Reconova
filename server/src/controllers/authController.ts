import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth";

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required." });
            return;
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ error: "An account with this email already exists." });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: name || null,
            },
        });

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || "fallback-secret",
            { expiresIn: "7d" }
        );

        res.status(201).json({
            message: "Account created successfully.",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                trialSessionsUsed: user.trialSessionsUsed,
            },
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required." });
            return;
        }

        // Find user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: "Invalid email or password." });
            return;
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            res.status(401).json({ error: "Invalid email or password." });
            return;
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || "fallback-secret",
            { expiresIn: "7d" }
        );

        res.json({
            message: "Logged in successfully.",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                trialSessionsUsed: user.trialSessionsUsed,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
};

export const getProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { id: true, email: true, name: true, plan: true, trialSessionsUsed: true, createdAt: true },
        });

        if (!user) {
            res.status(404).json({ error: "User not found." });
            return;
        }

        // For free users, sync trialSessionsUsed with actual session count
        if (user.plan === "free") {
            const actualCount = await prisma.reconciliationSession.count({
                where: { userId: user.id },
            });
            if (actualCount !== user.trialSessionsUsed) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { trialSessionsUsed: actualCount },
                });
                user.trialSessionsUsed = actualCount;
            }
        }

        res.json({ user });
    } catch (error) {
        console.error("Profile error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
};
