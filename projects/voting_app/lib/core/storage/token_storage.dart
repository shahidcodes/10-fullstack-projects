import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';

  final FlutterSecureStorage _storage;

  TokenStorage({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  // Save both tokens
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _accessTokenKey, value: accessToken),
      _storage.write(key: _refreshTokenKey, value: refreshToken),
    ]);
  }

  // Retrieve access token
  Future<String?> getAccessToken() async {
    return await _storage.read(key: _accessTokenKey);
  }

  // Retrieve refresh token
  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _refreshTokenKey);
  }

  // Delete both tokens during logout
  Future<void> clearTokens() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
    ]);
  }

  // Check whether an access token exists
  Future<bool> hasAccessToken() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }
}
