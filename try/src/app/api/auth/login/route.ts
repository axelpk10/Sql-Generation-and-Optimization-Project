import { NextResponse } from "next/server";
import { sign } from "jsonwebtoken";
import { z } from "zod";
import { cookies } from "next/headers";

// Validation schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate request body
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: result.error.issues },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Mock user for demo (like original repo)
    // For simplicity, let's just check password directly for demo
    const mockUser =
      email === "admin@demo.com"
        ? {
            _id: "demo-user-id",
            name: "Demo Admin",
            email: "admin@demo.com",
            password: "password123", // Plain text for demo
          }
        : null;

    if (!mockUser) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Simple password check for demo
    const isPasswordValid = password === mockUser.password;

    if (!isPasswordValid) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = sign(
      {
        id: mockUser._id,
        email: mockUser.email,
        name: mockUser.name,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: "auth-token",
      value: token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: mockUser._id,
          name: mockUser.name,
          email: mockUser.email,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "An error occurred during login" },
      { status: 500 }
    );
  }
}
