import 'package:dio/dio.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/network/dio_client.dart';
import '../models/auth_response_model.dart';
import '../models/user_model.dart';

class AuthService {
  final Dio _dio;

  AuthService(DioClient dioClient) : _dio = dioClient.dio;

  // Register
  Future<AuthResponseModel> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post(
        ApiConfig.register,
        data: {'name': name, 'email': email, 'password': password},
      );

      return AuthResponseModel.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Login
  Future<AuthResponseModel> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dio.post(
        ApiConfig.login,
        data: {'email': email, 'password': password},
      );

      return AuthResponseModel.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // Refresh access and refresh tokens
  Future<AuthResponseModel> refreshToken(String refreshToken) async {
    try {
      final response = await _dio.post(
        ApiConfig.refresh,
        data: {'refreshToken': refreshToken},
      );

      return AuthResponseModel.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<UserModel> getCurrentUser(String accessToken) async {
    try {
      final response = await _dio.get(ApiConfig.me);

      final data = response.data['data'] as Map<String, dynamic>;
      return UserModel.fromJson(data['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> logout(String accessToken) async {
    try {
      await _dio.post(ApiConfig.logout);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  // API error handling
  Exception _handleError(DioException error) {
    final responseData = error.response?.data;

    if (responseData is Map<String, dynamic>) {
      final message = responseData['message'];

      if (message is String && message.isNotEmpty) {
        return Exception(message);
      }
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception('Connection timed out. Please try again.');

      case DioExceptionType.connectionError:
        return Exception('Unable to connect to the server.');

      case DioExceptionType.cancel:
        return Exception('Request was cancelled.');

      default:
        return Exception('Something went wrong. Please try again.');
    }
  }
}
