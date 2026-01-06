package com.videocapture.auth

import android.content.Context
import android.content.SharedPreferences
import android.util.Base64
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.MessageDigest

/**
 * Secure authentication manager using Android Keystore and EncryptedSharedPreferences.
 * Provides local username/password authentication with secure storage.
 */
class SecureAuthManager(private val context: Context) {

    companion object {
        private const val TAG = "SecureAuthManager"
        private const val PREFS_NAME = "rork_secure_prefs"
        private const val KEY_USERNAME = "username"
        private const val KEY_PASSWORD_HASH = "password_hash"
        private const val KEY_SALT = "password_salt"
        private const val KEY_IS_REGISTERED = "is_registered"
        private const val KEY_LAST_LOGIN = "last_login"
    }

    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val securePrefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Check if a user is already registered.
     */
    fun isUserRegistered(): Boolean {
        return securePrefs.getBoolean(KEY_IS_REGISTERED, false)
    }

    /**
     * Register a new user with username and password.
     * @return true if registration successful, false if user already exists
     */
    fun register(username: String, password: String): AuthResult {
        if (username.isBlank()) {
            return AuthResult.Error("Username cannot be empty")
        }
        
        if (password.length < 4) {
            return AuthResult.Error("Password must be at least 4 characters")
        }
        
        if (isUserRegistered()) {
            return AuthResult.Error("User already registered. Please login.")
        }
        
        try {
            // Generate random salt
            val salt = generateSalt()
            
            // Hash password with salt
            val passwordHash = hashPassword(password, salt)
            
            // Store securely
            securePrefs.edit().apply {
                putString(KEY_USERNAME, username)
                putString(KEY_PASSWORD_HASH, passwordHash)
                putString(KEY_SALT, salt)
                putBoolean(KEY_IS_REGISTERED, true)
                putLong(KEY_LAST_LOGIN, System.currentTimeMillis())
            }.apply()
            
            Log.d(TAG, "User registered successfully: $username")
            return AuthResult.Success(username)
            
        } catch (e: Exception) {
            Log.e(TAG, "Registration failed", e)
            return AuthResult.Error("Registration failed: ${e.message}")
        }
    }

    /**
     * Login with username and password.
     * @return AuthResult indicating success or failure
     */
    fun login(username: String, password: String): AuthResult {
        if (!isUserRegistered()) {
            return AuthResult.Error("No user registered. Please register first.")
        }
        
        try {
            val storedUsername = securePrefs.getString(KEY_USERNAME, null)
            val storedHash = securePrefs.getString(KEY_PASSWORD_HASH, null)
            val storedSalt = securePrefs.getString(KEY_SALT, null)
            
            if (storedUsername == null || storedHash == null || storedSalt == null) {
                return AuthResult.Error("Corrupt credentials. Please re-register.")
            }
            
            // Check username
            if (username != storedUsername) {
                return AuthResult.Error("Invalid username")
            }
            
            // Hash provided password and compare
            val providedHash = hashPassword(password, storedSalt)
            
            if (providedHash != storedHash) {
                return AuthResult.Error("Invalid password")
            }
            
            // Update last login time
            securePrefs.edit().putLong(KEY_LAST_LOGIN, System.currentTimeMillis()).apply()
            
            Log.d(TAG, "Login successful: $username")
            return AuthResult.Success(username)
            
        } catch (e: Exception) {
            Log.e(TAG, "Login failed", e)
            return AuthResult.Error("Login failed: ${e.message}")
        }
    }

    /**
     * Get the currently registered username.
     */
    fun getUsername(): String? {
        return securePrefs.getString(KEY_USERNAME, null)
    }

    /**
     * Get the last login timestamp.
     */
    fun getLastLoginTime(): Long {
        return securePrefs.getLong(KEY_LAST_LOGIN, 0)
    }

    /**
     * Logout (just for session tracking, credentials remain).
     */
    fun logout() {
        Log.d(TAG, "User logged out")
        // Could implement session management here if needed
    }

    /**
     * Clear all stored credentials (for testing or account deletion).
     */
    fun clearCredentials() {
        securePrefs.edit().clear().apply()
        Log.d(TAG, "All credentials cleared")
    }

    /**
     * Generate a random salt for password hashing.
     */
    private fun generateSalt(): String {
        val bytes = ByteArray(16)
        java.security.SecureRandom().nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }

    /**
     * Hash password with salt using SHA-256.
     */
    private fun hashPassword(password: String, salt: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val saltedPassword = password + salt
        val hash = digest.digest(saltedPassword.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(hash, Base64.NO_WRAP)
    }

    /**
     * Authentication result sealed class.
     */
    sealed class AuthResult {
        data class Success(val username: String) : AuthResult()
        data class Error(val message: String) : AuthResult()
    }
}
