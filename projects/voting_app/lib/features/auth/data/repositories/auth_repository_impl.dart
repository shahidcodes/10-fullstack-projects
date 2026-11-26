import 'package:voting_app/features/auth/data/repositories/auth_repository.dart';
import 'package:voting_app/features/auth/data/services/auth_services.dart';

import '../models/auth_response_model.dart';
import '../models/user_model.dart';
import '../../../../core/storage/token_storage.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthService _authService;
  final TokenStorage _tokenStorage;

  AuthRepositoryImpl({required this._authService, required this._tokenStorage});
  @override
  Future<AuthResponseModel> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final result = await _authService.register(
      name: name,
      email: email,
      password: password,
    );

    await _saveTokens(result);
    return result;
  }

  @override
  Future<AuthResponseModel> login({
    required String email,
    required String password,
  }) async {
    final result = await _authService.login(email: email, password: password);

    await _saveTokens(result);
    return result;
  }

  @override
  Future<AuthResponseModel> refreshToken() async {
    final refreshToken = await _tokenStorage.getRefreshToken();

    if (refreshToken == null || refreshToken.isEmpty) {
      throw Exception('Refresh token not found. Please login again.');
    }

    final result = await _authService.refreshToken(refreshToken);

    await _saveTokens(result);
    return result;
  }

  @override
  Future<UserModel> getCurrentUser() async {
    final accessToken = await _tokenStorage.getAccessToken();

    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Access token not found. Please login again.');
    }

    return _authService.getCurrentUser(accessToken);
  }

  @override
  Future<void> logout() async {
    final accessToken = await _tokenStorage.getAccessToken();

    try {
      if (accessToken != null && accessToken.isNotEmpty) {
        await _authService.logout(accessToken);
      }
    } finally {
      // Always clear local tokens, even if the API request fails.
      await _tokenStorage.clearTokens();
    }
  }

  Future<void> _saveTokens(AuthResponseModel result) async {
    await _tokenStorage.saveTokens(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    );
  }
}
